// @wapixia/queue — Social post generation worker

import { Worker, type Job } from 'bullmq'
import Anthropic from '@anthropic-ai/sdk'
import { connection, QUEUE_NAMES } from '../config.js'
import type { SocialPostJobData, ContentGenerationResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'social-post'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

/**
 * Build the social post prompt from site context and post type.
 */
function buildSocialPrompt(
  siteContext: Record<string, unknown>,
  postType: string,
): string {
  const businessName = String(siteContext['name'] ?? '')
  const sector = String(siteContext['sector'] ?? '')
  const city = String(siteContext['city'] ?? '')
  const description = String(siteContext['description'] ?? '')

  return `Tu es un community manager expert pour les PME locales belges.

Entreprise : ${businessName}
Secteur : ${sector}
Ville : ${city}
Description : ${description}

Génère un post ${postType} engageant pour cette entreprise.

Règles :
- Ton professionnel mais accessible
- Inclure un appel à l'action clair
- Optimisé pour l'engagement (questions, emojis pertinents)
- Maximum 280 caractères pour Twitter, 2200 pour Facebook/Instagram
- Inclure 3-5 hashtags pertinents
- Langue : français belge

Réponds en JSON avec cette structure :
{
  "text": "Le texte du post",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "callToAction": "Le CTA",
  "suggestedImageQuery": "Requête pour trouver une image appropriée sur Unsplash"
}`
}

/**
 * Fetch an image URL from Unsplash based on a search query.
 */
async function fetchUnsplashImage(query: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    return null
  }

  try {
    const url = new URL('https://api.unsplash.com/search/photos')
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', '1')
    url.searchParams.set('orientation', 'landscape')

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as {
      results: Array<{ urls: { regular: string } }>
    }

    return data.results[0]?.urls.regular ?? null
  } catch {
    return null
  }
}

async function processSocialPost(
  job: Job<SocialPostJobData>,
): Promise<ContentGenerationResult> {
  const { siteId, postType = 'facebook' } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, siteId }

  workerLogger.info('Starting social post generation', ctx)

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
  }

  // Generate content via Claude
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const prompt = buildSocialPrompt(siteContext, postType)

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

  // Parse the generated content
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
    throw new Error('Failed to parse social post JSON from Claude')
  }

  // Fetch Unsplash image
  const imageQuery = String(generatedContent['suggestedImageQuery'] ?? site.sector)
  const imageUrl = await fetchUnsplashImage(imageQuery)

  // Determine auto-approval status
  const autoApprove = process.env.AUTO_APPROVE_CONTENT === 'true'
  const status = autoApprove ? 'auto_approved' : 'pending_validation'

  // Save to ai_contents table
  const { data: content, error: insertError } = await supabase
    .from('ai_contents')
    .insert({
      site_id: siteId,
      type: `social_${postType}`,
      content: generatedContent,
      image_url: imageUrl,
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
    purpose: 'social_post',
  })

  workerLogger.info('Social post generated successfully', {
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

export const socialPostWorker = new Worker<SocialPostJobData, ContentGenerationResult>(
  QUEUE_NAMES.SOCIAL,
  processSocialPost,
  {
    connection,
    concurrency: 3,
    limiter: { max: 10, duration: 60_000 },
  },
)

socialPostWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    siteId: job.data.siteId,
  })
})

socialPostWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    siteId: job?.data.siteId,
    error,
  })
})
