// @wapixia/queue — GMB post generation worker

import { Worker, type Job } from 'bullmq'
import Anthropic from '@anthropic-ai/sdk'
import { connection, QUEUE_NAMES } from '../config.js'
import type { GmbPostJobData, ContentGenerationResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'gmb-post'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

/**
 * Build the GMB post prompt from site context.
 */
function buildGmbPrompt(siteContext: Record<string, unknown>): string {
  const businessName = String(siteContext['name'] ?? '')
  const sector = String(siteContext['sector'] ?? '')
  const city = String(siteContext['city'] ?? '')
  const description = String(siteContext['description'] ?? '')
  const services = String(siteContext['services'] ?? '')

  return `Tu es un expert Google My Business pour les PME locales belges.

Entreprise : ${businessName}
Secteur : ${sector}
Ville : ${city}
Description : ${description}
Services : ${services}

Génère un post Google My Business engageant.

Règles :
- Maximum 1500 caractères (limite GMB)
- Inclure un appel à l'action (Réserver, Appeler, En savoir plus, Acheter)
- Optimisé pour le référencement local (mentionner la ville)
- Ton professionnel et informatif
- Mettre en avant un service ou une actualité
- Pas de hashtags (GMB ne les supporte pas bien)
- Langue : français belge

Réponds en JSON avec cette structure :
{
  "text": "Le texte du post GMB",
  "callToAction": {
    "type": "BOOK" | "CALL" | "LEARN_MORE" | "ORDER" | "SHOP",
    "label": "Libellé du bouton"
  },
  "topicType": "STANDARD" | "EVENT" | "OFFER",
  "suggestedImageQuery": "Requête pour trouver une image sur Unsplash"
}`
}

async function processGmbPost(
  job: Job<GmbPostJobData>,
): Promise<ContentGenerationResult> {
  const { siteId } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, siteId }

  workerLogger.info('Starting GMB post generation', ctx)

  const supabase = createSupabaseClient()

  // Load site context
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name, sector, onboarding_data, organization_id, gmb_location_id')
    .eq('id', siteId)
    .single()

  if (siteError || !site) {
    throw new Error(`Site not found: ${siteId}`)
  }

  if (!site.gmb_location_id) {
    workerLogger.warn('Site has no GMB location ID, skipping', ctx)
    return { contentId: '', tokensUsed: 0, status: 'pending_validation' }
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

  const prompt = buildGmbPrompt(siteContext)

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
    throw new Error('Failed to parse GMB post JSON from Claude')
  }

  // Save to ai_contents table
  const status = 'pending_validation' as const

  const { data: content, error: insertError } = await supabase
    .from('ai_contents')
    .insert({
      site_id: siteId,
      type: 'gmb_post',
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
    purpose: 'gmb_post',
  })

  workerLogger.info('GMB post generated successfully', {
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

export const gmbPostWorker = new Worker<GmbPostJobData, ContentGenerationResult>(
  QUEUE_NAMES.GMB,
  processGmbPost,
  {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60_000 },
  },
)

gmbPostWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    siteId: job.data.siteId,
  })
})

gmbPostWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    siteId: job?.data.siteId,
    error,
  })
})
