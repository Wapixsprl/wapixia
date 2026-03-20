# SPRINT 3 — BULLMQ_JOBS.md
# Architecture BullMQ — Jobs Asynchrones
> Ce fichier définit chaque queue, chaque job et chaque worker du Sprint 3.

---

## 1. Vue d'ensemble des queues

```
┌─────────────────────────────────────────────────────────┐
│                    REDIS (BullMQ)                       │
├─────────────────┬───────────────┬───────────────────────┤
│ content:social  │ content:gmb   │ content:blog          │
│ MEDIUM priority │ MEDIUM        │ LOW priority          │
│ 10 workers      │ 5 workers     │ 5 workers             │
├─────────────────┼───────────────┼───────────────────────┤
│ reputation:reviews              │ sites:publish         │
│ HIGH priority                   │ HIGH priority         │
│ 10 workers                      │ 20 workers            │
├─────────────────────────────────┼───────────────────────┤
│ notifications:email             │ notifications:sms     │
│ HIGH priority — 20 workers      │ HIGH — 10 workers     │
└─────────────────────────────────┴───────────────────────┘
```

---

## 2. Configuration globale BullMQ

```typescript
// packages/queue/src/config.ts

import { Queue, Worker, QueueEvents } from 'bullmq'
import { Redis } from 'ioredis'

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,    // requis par BullMQ
  enableReadyCheck: false,
})

export const QUEUE_NAMES = {
  SOCIAL:       'content:social',
  GMB:          'content:gmb',
  BLOG:         'content:blog',
  REVIEWS:      'reputation:reviews',
  PUBLISH:      'sites:publish',
  EMAIL:        'notifications:email',
  SMS:          'notifications:sms',
  ALERT:        'notifications:alert',
} as const

// Options par défaut par queue
export const QUEUE_DEFAULT_OPTIONS = {
  [QUEUE_NAMES.SOCIAL]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 7 * 24 * 3600 },  // garder 7 jours
      removeOnFail: { age: 30 * 24 * 3600 },      // garder 30 jours en cas d'échec
      timeout: 120_000,                            // 2 min max
    },
  },
  [QUEUE_NAMES.REVIEWS]: {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
      timeout: 60_000,                             // 1 min max (réponses courtes)
      priority: 1,                                 // HIGH priority
    },
  },
  [QUEUE_NAMES.PUBLISH]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 30_000 },  // retry après 30s (APIs externes)
      removeOnComplete: { age: 3 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
      timeout: 60_000,
      priority: 1,
    },
  },
  [QUEUE_NAMES.BLOG]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
      timeout: 300_000,                            // 5 min max (articles longs)
    },
  },
}

// Créer toutes les queues
export function createQueues() {
  return Object.fromEntries(
    Object.entries(QUEUE_NAMES).map(([key, name]) => [
      key,
      new Queue(name, { connection, ...QUEUE_DEFAULT_OPTIONS[name] })
    ])
  )
}
```

---

## 3. Jobs — Module Posts RS (content:social)

### Job : generate-social-posts

```typescript
// packages/queue/src/jobs/social/generate-posts.job.ts

interface GenerateSocialPostsJobData {
  siteId: string
  forceGenerate?: boolean     // bypasse la vérification de quota mensuel
  postTypes?: string[]        // si non fourni, calculé automatiquement selon le mois
}

export async function procesGenerateSocialPosts(
  job: Job<GenerateSocialPostsJobData>
): Promise<void> {
  const { siteId } = job.data
  await job.log(`[${siteId}] Début génération posts sociaux`)

  // 1. Récupérer le contexte du site
  const site = await db.query.sites.findFirst({
    where: eq(sites.id, siteId),
    with: { siteModules: true }
  })

  if (!site) throw new Error(`Site ${siteId} introuvable`)

  const moduleConfig = getSiteModuleConfig(site, 'social_posts')
  const context = await buildSiteContext(site)

  // 2. Vérifier le quota mensuel
  if (!job.data.forceGenerate) {
    const publishedThisMonth = await countPublishedContent(siteId, 'social_posts')
    if (publishedThisMonth >= moduleConfig.postsPerMonth) {
      await job.log(`Quota mensuel atteint (${publishedThisMonth}/${moduleConfig.postsPerMonth})`)
      return
    }
  }

  // 3. Déterminer le type de post selon la rotation mensuelle
  const { season, month, events } = getSeasonalContext()
  context.currentSeason = season
  context.currentMonth = month
  context.recentEvents = events

  const postTypes = job.data.postTypes || getPostTypeSchedule(new Date().getMonth() + 1)
  const postType = postTypes[Math.floor(Math.random() * postTypes.length)]

  // 4. Récupérer les contenus précédents (anti-duplication)
  const previousContent = await getPreviousContent(siteId, 'social_posts', 5)
  context.previousContent = previousContent

  // 5. Appeler Claude API
  await job.updateProgress(20)
  const prompt = buildSocialPrompt(context, postType)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: SOCIAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '')
  await job.updateProgress(60)

  // 6. Tracker les tokens
  await trackTokenUsage({
    siteId,
    moduleId: 'social_posts',
    model: 'claude-sonnet-4-6',
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  })
  await checkCostThreshold(siteId)

  // 7. Récupérer les images Unsplash
  const facebookImage = await unsplashService.getImageForPost({
    sector: site.sector,
    keywords: content.facebook.suggestedImageKeywords,
    orientation: 'landscape',
  })

  const instagramImage = await unsplashService.getImageForPost({
    sector: site.sector,
    keywords: content.instagram.suggestedImageKeywords,
    orientation: 'squarish',
  })
  await job.updateProgress(80)

  // 8. Calculer la date de publication planifiée
  const scheduledFor = calculateNextPublishDate(
    moduleConfig.postingDays,
    moduleConfig.postingHour,
  )

  // 9. Insérer les contenus en BDD
  const platforms = moduleConfig.platforms

  for (const platform of platforms) {
    const platformContent = platform === 'facebook' ? content.facebook : content.instagram
    const image = platform === 'facebook' ? facebookImage : instagramImage

    await db.insert(aiContents).values({
      siteId,
      moduleId: 'social_posts',
      type: 'social_post',
      platform,
      content: platformContent.content,
      hashtags: platform === 'instagram' ? content.instagram.hashtags : [],
      visualUrl: image.url,
      visualAlt: image.altText,
      metadata: {
        callToAction: platformContent.callToAction,
        attribution: image.attribution,
        postType,
        bestPublishTime: content.bestPublishTime,
      },
      status: moduleConfig.autoPublish ? 'auto_approved' : 'pending_validation',
      autoPublish: moduleConfig.autoPublish,
      scheduledFor,
      promptVersion: '1.0',
      modelUsed: 'claude-sonnet-4-6',
      tokensInput: Math.floor(response.usage.input_tokens / platforms.length),
      tokensOutput: Math.floor(response.usage.output_tokens / platforms.length),
    })
  }

  await job.updateProgress(100)
  await job.log(`[${siteId}] ${platforms.length} posts générés — scheduledFor: ${scheduledFor}`)

  // 10. Notifier le client si mode validation
  if (!moduleConfig.autoPublish) {
    await emailQueue.add('content-ready-notification', {
      siteId,
      contentType: 'social_posts',
      count: platforms.length,
    })
  }
}
```

---

## 4. Jobs — Module GMB & Avis (reputation:reviews + content:gmb)

### Job : sync-gmb-reviews

```typescript
// packages/queue/src/jobs/gmb/sync-reviews.job.ts

interface SyncGMBReviewsJobData {
  siteId: string
}

export async function processSyncGMBReviews(job: Job<SyncGMBReviewsJobData>): Promise<void> {
  const { siteId } = job.data

  // 1. Vérifier que le site a un GMB connecté
  const site = await getSiteWithGoogleToken(siteId)
  if (!site.gmbLocationId || !site.googleOauthToken) {
    await job.log(`Site ${siteId} sans GMB connecté — skip`)
    return
  }

  // 2. Fetcher les avis depuis l'API GMB
  await job.updateProgress(10)
  const reviews = await gmbService.syncReviews(siteId)
  await job.updateProgress(50)

  // 3. Pour chaque nouvel avis sans réponse → générer une réponse
  const newUnanswered = reviews.filter(r => r.isNew && !r.hasReply && r.comment)

  for (const review of newUnanswered) {
    await reviewsQueue.add(
      'generate-review-reply',
      { siteId, reviewId: review.id },
      { priority: review.isNegative ? 1 : 5 }  // priorité haute pour les négatifs
    )
  }

  // 4. Alerter immédiatement si avis négatifs non traités
  const newNegatives = reviews.filter(r => r.isNew && r.isNegative)
  if (newNegatives.length > 0) {
    await alertQueue.add('negative-review-alert', {
      siteId,
      reviewIds: newNegatives.map(r => r.id),
    }, { priority: 1 })
  }

  await job.updateProgress(100)
  await job.log(`[${siteId}] Sync GMB: ${reviews.length} avis, ${newUnanswered.length} sans réponse, ${newNegatives.length} négatifs`)
}
```

### Job : generate-review-reply

```typescript
// packages/queue/src/jobs/gmb/generate-reply.job.ts

interface GenerateReviewReplyJobData {
  siteId: string
  reviewId: string
}

export async function processGenerateReviewReply(job: Job<GenerateReviewReplyJobData>): Promise<void> {
  const { siteId, reviewId } = job.data

  // 1. Récupérer l'avis et le contexte du site
  const [review, site] = await Promise.all([
    db.query.googleReviews.findFirst({ where: eq(googleReviews.id, reviewId) }),
    db.query.sites.findFirst({ where: eq(sites.id, siteId) }),
  ])

  if (!review || !site) throw new Error('Review ou site introuvable')
  await job.updateProgress(10)

  // 2. Cas : avis sans commentaire
  if (!review.comment) {
    const simpleReply = await generateNoCommentReply(site, review)
    await insertReviewReply(reviewId, siteId, simpleReply, 'claude-haiku-4-5-20251001', 0, 0)
    return
  }

  // 3. Construire le contexte du site
  const context = await buildSiteContext(site)

  // 4. Choisir le prompt selon la note
  const isNegative = review.rating <= 2
  const prompt = isNegative
    ? negativeReviewReplyPrompt(context, review)
    : positiveReviewReplyPrompt(context, review)

  // 5. Appeler Claude (Haiku pour les réponses — économique)
  await job.updateProgress(30)
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: REVIEW_REPLY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const replyData = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '')
  await job.updateProgress(70)

  // 6. Tracker les tokens
  await trackTokenUsage({
    siteId,
    moduleId: 'gmb_reviews',
    model: 'claude-haiku-4-5-20251001',
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  })

  // 7. Insérer le contenu généré
  const moduleConfig = await getModuleConfig(siteId, 'gmb_reviews')
  const contentId = await insertReviewReply(
    reviewId, siteId, replyData.reply, 'claude-haiku-4-5-20251001',
    response.usage.input_tokens, response.usage.output_tokens
  )

  // 8. Mettre à jour le statut de l'avis
  await db.update(googleReviews)
    .set({ replyStatus: 'generated', aiContentId: contentId })
    .where(eq(googleReviews.id, reviewId))
  await job.updateProgress(90)

  // 9. Si auto-publish → publier directement sur GMB
  if (moduleConfig.autoPublishReplies) {
    await publishQueue.add('publish-review-reply', {
      siteId,
      reviewId,
      contentId,
    }, { priority: 1 })
  } else {
    // Notifier le client qu'une réponse attend validation
    await emailQueue.add('review-reply-ready', { siteId, reviewId, isNegative })
  }

  await job.updateProgress(100)
}
```

### Job : generate-gmb-post

```typescript
// packages/queue/src/jobs/gmb/generate-post.job.ts

interface GenerateGMBPostJobData {
  siteId: string
  postType?: 'update' | 'offer' | 'event'
  offer?: string
}

export async function processGenerateGMBPost(job: Job<GenerateGMBPostJobData>): Promise<void> {
  const { siteId } = job.data
  const site = await getSiteWithContext(siteId)
  const context = await buildSiteContext(site)

  const { month, events } = getSeasonalContext()
  context.currentMonth = month
  context.recentEvents = events

  // Alterner update / offer selon la semaine
  const postType = job.data.postType || (Math.random() > 0.7 ? 'offer' : 'update')
  const prompt = postType === 'offer'
    ? gmbOfferPostPrompt(context, job.data.offer)
    : gmbUpdatePostPrompt(context)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: GMB_POST_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const postData = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '')

  await trackTokenUsage({
    siteId, moduleId: 'gmb_reviews',
    model: 'claude-sonnet-4-6',
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  })

  const image = await unsplashService.getImageForPost({
    sector: site.sector,
    keywords: postData.suggestedImageKeywords,
    orientation: 'landscape',
  })

  const moduleConfig = await getModuleConfig(siteId, 'gmb_reviews')
  const scheduledFor = new Date() // GMB posts publiés rapidement

  await db.insert(aiContents).values({
    siteId,
    moduleId: 'gmb_reviews',
    type: 'gmb_post',
    platform: 'gmb',
    title: postData.title,
    content: postData.content,
    visualUrl: image.url,
    metadata: {
      callToAction: postData.callToAction,
      postType,
      seoKeywords: postData.seoKeywords,
    },
    status: moduleConfig.autoPublishGMBPosts ? 'auto_approved' : 'pending_validation',
    scheduledFor,
    promptVersion: '1.0',
    modelUsed: 'claude-sonnet-4-6',
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  })
}
```

---

## 5. Jobs — Module Blog SEO (content:blog)

### Job : generate-blog-article

```typescript
// packages/queue/src/jobs/blog/generate-article.job.ts

interface GenerateBlogArticleJobData {
  siteId: string
  topic?: string        // si fourni, ignorer le générateur de sujets
  keyword?: string
}

export async function processGenerateBlogArticle(job: Job<GenerateBlogArticleJobData>): Promise<void> {
  const { siteId } = job.data
  const site = await getSiteWithContext(siteId)
  const context = await buildSiteContext(site)
  const moduleConfig = await getModuleConfig(siteId, 'blog_seo')

  // 1. Vérifier le quota mensuel
  const publishedThisMonth = await countPublishedContent(siteId, 'blog_seo')
  if (publishedThisMonth >= moduleConfig.articlesPerMonth) {
    await job.log(`Quota mensuel atteint (${publishedThisMonth}/${moduleConfig.articlesPerMonth})`)
    return
  }

  await job.updateProgress(10)

  // 2. Déterminer le sujet
  let topic = job.data.topic
  let keyword = job.data.keyword

  if (!topic) {
    // Générer un sujet si non fourni
    const previousTopics = await getPublishedBlogTopics(siteId, 20)
    const topicsResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: topicGeneratorPrompt(context, 3, previousTopics)
      }],
    })
    const topics = JSON.parse(topicsResponse.content[0].type === 'text' ? topicsResponse.content[0].text : '')
    const selectedTopic = topics.topics[0]
    topic = selectedTopic.title
    keyword = selectedTopic.keyword
  }

  await job.updateProgress(20)
  await job.log(`[${siteId}] Sujet sélectionné: "${topic}" — keyword: "${keyword}"`)

  // 3. Récupérer les sujets précédents (anti-duplication)
  const previousTopics = await getPublishedBlogTopics(siteId, 10)
  const previousContent = await getPreviousContent(siteId, 'blog_seo', 5)

  // 4. Générer l'article
  const prompt = blogArticlePrompt(context, {
    topic,
    keyword,
    wordCount: moduleConfig.minWordCount,
    previousTopics,
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: BLOG_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const article = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '')
  await job.updateProgress(60)

  // 5. Vérifier la longueur
  if (article.totalWordCount < moduleConfig.minWordCount * 0.9) {
    await job.log(`Article trop court (${article.totalWordCount} mots) — retry`)
    throw new Error(`Article trop court: ${article.totalWordCount} mots`)
  }

  // 6. Tracker les tokens
  await trackTokenUsage({
    siteId, moduleId: 'blog_seo',
    model: 'claude-sonnet-4-6',
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  })

  await job.updateProgress(70)

  // 7. Image Unsplash
  const image = await unsplashService.getImageForPost({
    sector: site.sector,
    keywords: article.suggestedImageKeywords,
    orientation: 'landscape',
  })

  // 8. Calculer la date de publication
  const scheduledFor = calculateNextMondayPublish()

  // 9. Insérer en BDD
  const contentId = await db.insert(aiContents).values({
    siteId,
    moduleId: 'blog_seo',
    type: 'blog_article',
    platform: 'blog',
    title: article.title,
    content: buildFullArticleHTML(article),  // assembler les sections en HTML
    excerpt: article.excerpt,
    visualUrl: image.url,
    visualAlt: image.altText,
    metadata: {
      slug: article.slug,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      primaryKeyword: article.primaryKeyword,
      secondaryKeywords: article.secondaryKeywords,
      wordCount: article.totalWordCount,
      schemaFAQ: article.schemaFAQ,
      internalLinks: article.internalLinks,
      attribution: image.attribution,
    },
    status: moduleConfig.autoPublish ? 'auto_approved' : 'pending_validation',
    scheduledFor,
    promptVersion: '1.0',
    modelUsed: 'claude-sonnet-4-6',
    tokensInput: response.usage.input_tokens,
    tokensOutput: response.usage.output_tokens,
  }).returning({ id: aiContents.id })

  await job.updateProgress(100)
  await job.log(`[${siteId}] Article généré: "${article.title}" — ${article.totalWordCount} mots`)

  // 10. Notifier le client
  if (!moduleConfig.autoPublish) {
    await emailQueue.add('content-ready-notification', {
      siteId, contentType: 'blog_article', contentId: contentId[0].id, title: article.title,
    })
  }
}
```

---

## 6. Job : publish-content (publication multi-plateforme)

```typescript
// packages/queue/src/jobs/publish/publish-content.job.ts

interface PublishContentJobData {
  contentId: string
}

export async function processPublishContent(job: Job<PublishContentJobData>): Promise<void> {
  const { contentId } = job.data

  const content = await db.query.aiContents.findFirst({
    where: eq(aiContents.id, contentId),
    with: { site: { with: { socialAccounts: true } } },
  })

  if (!content) throw new Error(`Content ${contentId} introuvable`)
  if (!['approved', 'auto_approved'].includes(content.status)) {
    await job.log(`Content ${contentId} non approuvé (status: ${content.status}) — skip`)
    return
  }

  await job.updateProgress(10)

  try {
    let externalId: string | null = null
    let externalUrl: string | null = null

    switch (content.type) {
      case 'social_post': {
        const account = content.site.socialAccounts.find(a => a.platform === content.platform)
        if (!account) throw new Error(`Compte ${content.platform} non connecté pour le site ${content.site.id}`)

        const decryptedToken = decrypt(account.accessToken, process.env.ENCRYPTION_KEY)

        if (content.platform === 'facebook') {
          const result = await metaService.publishFacebookPost({
            pageId: account.platformPageId,
            accessToken: decryptedToken,
            message: content.content,
            imageUrl: content.visualUrl || undefined,
          })
          externalId = result.postId
          externalUrl = result.postUrl
        }

        if (content.platform === 'instagram') {
          if (!content.visualUrl) throw new Error('Instagram nécessite une image')
          const result = await metaService.publishInstagramPost({
            igUserId: account.platformUserId,
            accessToken: decryptedToken,
            imageUrl: content.visualUrl,
            caption: `${content.content}\n\n${content.hashtags?.map(h => `#${h}`).join(' ') || ''}`,
          })
          externalId = result.postId
        }
        break
      }

      case 'gmb_post': {
        const result = await gmbService.publishGMBPost(content.site.id, {
          summary: content.content,
          callToAction: content.metadata?.callToAction,
          mediaUrl: content.visualUrl || undefined,
        })
        externalId = result
        break
      }

      case 'review_reply': {
        const reviewId = content.metadata?.reviewId
        const review = await db.query.googleReviews.findFirst({
          where: eq(googleReviews.id, reviewId)
        })
        await gmbService.publishReply(content.site.id, review.gmbReviewId, content.content)
        await db.update(googleReviews)
          .set({ replyStatus: 'published', publishedAt: new Date() })
          .where(eq(googleReviews.id, reviewId))
        break
      }

      case 'blog_article': {
        // Publier dans Payload CMS
        await payloadCMS.create({
          collection: 'blog-posts',
          data: {
            siteId: content.siteId,
            title: content.title,
            slug: content.metadata.slug,
            content: content.content,
            excerpt: content.excerpt,
            featuredImage: content.visualUrl,
            seo: {
              metaTitle: content.metadata.metaTitle,
              metaDescription: content.metadata.metaDescription,
            },
            faqSchema: content.metadata.schemaFAQ,
            status: 'published',
            publishedAt: new Date(),
          }
        })
        externalUrl = `https://${content.site.tempDomain || content.site.customDomain}/blog/${content.metadata.slug}`
        break
      }
    }

    // Mettre à jour le contenu comme publié
    await db.update(aiContents)
      .set({
        status: 'published',
        publishedAt: new Date(),
        externalId,
        externalUrl,
      })
      .where(eq(aiContents.id, contentId))

    await job.updateProgress(100)
    await job.log(`[${contentId}] Publié sur ${content.platform} — externalId: ${externalId}`)

  } catch (error) {
    // Marquer comme échec de publication
    await db.update(aiContents)
      .set({
        status: 'publish_failed',
        publishError: error.message,
      })
      .where(eq(aiContents.id, contentId))

    // Alerter Wapix admin
    await alertQueue.add('publish-failed-alert', {
      contentId,
      siteId: content.siteId,
      platform: content.platform,
      error: error.message,
    })

    throw error  // BullMQ retry
  }
}
```

---

## 7. Job : negative-review-alert

```typescript
// packages/queue/src/jobs/alerts/negative-review-alert.job.ts

interface NegativeReviewAlertJobData {
  siteId: string
  reviewIds: string[]
}

export async function processNegativeReviewAlert(job: Job<NegativeReviewAlertJobData>): Promise<void> {
  const { siteId, reviewIds } = job.data

  const [site, reviews] = await Promise.all([
    getSiteWithOwner(siteId),
    db.query.googleReviews.findMany({
      where: inArray(googleReviews.id, reviewIds)
    })
  ])

  // Email au client WapixIA
  await emailQueue.add('send-email', {
    templateId: process.env.BREVO_TEMPLATE_NEGATIVE_REVIEW_ALERT,
    to: site.ownerEmail,
    params: {
      siteName: site.name,
      reviewCount: reviews.length,
      reviews: reviews.map(r => ({
        author: r.authorName,
        rating: r.rating,
        comment: r.comment?.slice(0, 200),
        date: r.reviewDate,
        dashboardUrl: `https://app.wapixia.com/content/reviews?highlight=${r.id}`,
      })),
    }
  }, { priority: 1 })

  // SMS si activé
  const moduleConfig = await getModuleConfig(siteId, 'gmb_reviews')
  if (moduleConfig.negativeAlertSms && site.ownerPhone) {
    await smsQueue.add('send-sms', {
      to: site.ownerPhone,
      message: `⚠️ WapixIA — ${reviews.length} avis négatif(s) reçu(s) sur ${site.name}. Connectez-vous pour y répondre.`,
    }, { priority: 1 })
  }

  // Email interne Wapix
  await emailQueue.add('send-email', {
    to: process.env.WAPIX_ALERT_EMAIL,
    subject: `[ALERT] Avis négatif — ${site.name}`,
    text: `Site: ${site.name}\nAvis: ${reviews.map(r => `${r.rating}★ de ${r.authorName}: ${r.comment}`).join('\n')}`,
  }, { priority: 1 })

  // Marquer les avis comme alertés
  await db.update(googleReviews)
    .set({ alertSent: true, alertSentAt: new Date() })
    .where(inArray(googleReviews.id, reviewIds))
}
```

---

## 8. Monitoring des queues

```typescript
// packages/queue/src/monitoring.ts

// Dashboard BullMQ Board (accessible sur /admin/queues)
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'

export function setupQueueDashboard(app: FastifyInstance) {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath('/admin/queues')

  createBullBoard({
    queues: Object.values(queues).map(q => new BullMQAdapter(q)),
    serverAdapter,
  })

  // Accessible uniquement aux SuperAdmin
  app.use('/admin/queues', authMiddleware('superadmin'), serverAdapter.getRouter())
}

// Métriques clés à surveiller
export async function getQueueMetrics() {
  const metrics: Record<string, object> = {}

  for (const [name, queue] of Object.entries(queues)) {
    const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'completed', 'delayed')
    metrics[name] = counts
  }

  return metrics
}
```
