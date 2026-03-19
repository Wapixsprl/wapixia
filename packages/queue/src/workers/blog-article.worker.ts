// @wapixia/queue — Blog article generation worker

import { Worker, type Job } from 'bullmq'
import Anthropic from '@anthropic-ai/sdk'
import { connection, QUEUE_NAMES } from '../config.js'
import type { BlogArticleJobData, ContentGenerationResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'blog-article'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8192

/**
 * Build the blog article prompt from site context.
 */
function buildBlogPrompt(
  siteContext: Record<string, unknown>,
  topic?: string,
): string {
  const businessName = String(siteContext['name'] ?? '')
  const sector = String(siteContext['sector'] ?? '')
  const city = String(siteContext['city'] ?? '')
  const description = String(siteContext['description'] ?? '')
  const services = String(siteContext['services'] ?? '')

  const topicInstruction = topic
    ? `Sujet imposé : ${topic}`
    : `Choisis un sujet pertinent lié au secteur "${sector}" et aux services de l'entreprise.`

  return `Tu es un rédacteur SEO expert pour les PME locales belges.

Entreprise : ${businessName}
Secteur : ${sector}
Ville : ${city}
Description : ${description}
Services : ${services}

${topicInstruction}

Rédige un article de blog complet et optimisé SEO (1200-2500 mots).

Règles :
- Structure : H1 + intro TLDR + H2 sous forme de questions + contenu riche + conclusion avec CTA
- Intégrer naturellement le nom de la ville et le secteur pour le SEO local
- Ton professionnel mais accessible (français belge, vouvoiement)
- Chaque section H2 doit être une réponse complète et standalone (extractible par les IA)
- Pas de superlatifs vides
- Inclure des données concrètes ou des conseils pratiques
- Optimiser pour les featured snippets Google et les réponses IA

Réponds en JSON avec cette structure :
{
  "title": "Titre H1 de l'article",
  "slug": "slug-seo-de-l-article",
  "metaTitle": "Meta title SEO (max 60 caractères)",
  "metaDescription": "Meta description SEO (max 155 caractères)",
  "excerpt": "Résumé de l'article en 2-3 phrases",
  "content": "Le contenu complet en Markdown avec les H2, H3, etc.",
  "tags": ["tag1", "tag2", "tag3"],
  "estimatedReadTime": 5,
  "suggestedImageQuery": "Requête pour trouver une image sur Unsplash"
}`
}

async function processBlogArticle(
  job: Job<BlogArticleJobData>,
): Promise<ContentGenerationResult> {
  const { siteId, topic } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, siteId }

  workerLogger.info('Starting blog article generation', ctx)

  const supabase = createSupabaseClient()

  // Load site context
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name, sector, onboarding_data, organization_id')
    .eq('id', siteId)
    .single()

  if (siteError || !site) {
    throw new Error(`Site not found: ${siteId}`)
  }

  const onboardingData = (site.onboarding_data ?? {}) as Record<string, unknown>
  const locationData = (onboardingData['location'] ?? {}) as Record<string, unknown>

  const siteContext: Record<string, unknown> = {
    name: site.name,
    sector: site.sector,
    city: String(locationData['city'] ?? ''),
    description: String(onboardingData['description'] ?? ''),
    services: JSON.stringify(onboardingData['services'] ?? []),
  }

  // Generate content via Claude
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const prompt = buildBlogPrompt(siteContext, topic)

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude response did not contain a text block')
  }

  const tokensUsed =
    (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0)

  // Parse generated content
  let generatedContent: Record<string, unknown>
  try {
    let cleaned = textBlock.text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(cleaned.indexOf('\n') + 1)
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3).trim()
      }
    }
    generatedContent = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    throw new Error('Failed to parse blog article JSON from Claude')
  }

  // Save to ai_contents table
  const status = 'pending_validation' as const

  const { data: content, error: insertError } = await supabase
    .from('ai_contents')
    .insert({
      site_id: siteId,
      type: 'blog_article',
      content: generatedContent,
      status,
      tokens_used: tokensUsed,
      model_used: MODEL,
    })
    .select('id')
    .single()

  if (insertError || !content) {
    throw new Error(`Failed to save content: ${insertError?.message ?? 'unknown'}`)
  }

  // Track token usage
  await supabase.from('token_usage').insert({
    site_id: siteId,
    organization_id: site.organization_id,
    model: MODEL,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    purpose: 'blog_article',
  })

  workerLogger.info('Blog article generated successfully', {
    ...ctx,
    contentId: content.id as string,
    tokensUsed,
  })

  return {
    contentId: content.id as string,
    tokensUsed,
    status,
  }
}

// ── Worker instance ──

export const blogArticleWorker = new Worker<BlogArticleJobData, ContentGenerationResult>(
  QUEUE_NAMES.BLOG,
  processBlogArticle,
  {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60_000 },
  },
)

blogArticleWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    siteId: job.data.siteId,
  })
})

blogArticleWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    siteId: job?.data.siteId,
    error,
  })
})
