// @wapixia/queue — Review reply generation worker (uses Haiku for speed/cost)

import { Worker, type Job } from 'bullmq'
import Anthropic from '@anthropic-ai/sdk'
import { connection, QUEUE_NAMES } from '../config.js'
import type { ReviewReplyJobData, ContentGenerationResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'review-reply'
const MODEL = 'claude-haiku-4-5' // Haiku for speed and cost efficiency
const MAX_TOKENS = 512

/**
 * Build the review reply prompt.
 */
function buildReviewReplyPrompt(
  siteContext: Record<string, unknown>,
  review: Record<string, unknown>,
): string {
  const businessName = String(siteContext['name'] ?? '')
  const sector = String(siteContext['sector'] ?? '')
  const reviewerName = String(review['reviewer_name'] ?? 'Client')
  const rating = Number(review['rating'] ?? 0)
  const reviewText = String(review['comment'] ?? '')

  const sentiment = rating >= 4 ? 'positif' : rating >= 3 ? 'neutre' : 'negatif'

  return `Tu es le responsable de ${businessName} (secteur: ${sector}).
Tu réponds à un avis Google.

Avis de ${reviewerName} (${rating}/5 - ${sentiment}) :
"${reviewText}"

Rédige une réponse professionnelle et empathique.

Règles :
- Remercier le client par son prénom
- Si positif : remercier chaleureusement, inviter à revenir
- Si neutre : remercier, proposer d'améliorer l'expérience
- Si négatif : s'excuser, proposer une solution concrète, inviter à contacter en privé
- Maximum 300 mots
- Ton professionnel et humain (français belge, vouvoiement)
- Ne jamais être défensif ni agressif
- Signer avec le nom de l'entreprise

Réponds en JSON :
{
  "replyText": "La réponse complète",
  "sentiment": "positive" | "neutral" | "negative",
  "suggestedAction": "none" | "follow_up" | "urgent"
}`
}

async function processReviewReply(
  job: Job<ReviewReplyJobData>,
): Promise<ContentGenerationResult> {
  const { siteId, reviewId } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, siteId, reviewId }

  workerLogger.info('Starting review reply generation', ctx)

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

  // Load the review
  const { data: review, error: reviewError } = await supabase
    .from('google_reviews')
    .select('*')
    .eq('id', reviewId)
    .single()

  if (reviewError || !review) {
    throw new Error(`Review not found: ${reviewId}`)
  }

  const siteContext: Record<string, unknown> = {
    name: site.name,
    sector: site.sector,
  }

  const reviewData: Record<string, unknown> = {
    reviewer_name: review.reviewer_name,
    rating: review.rating,
    comment: review.comment,
  }

  // Generate reply via Claude Haiku
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const prompt = buildReviewReplyPrompt(siteContext, reviewData)

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

  // Parse generated reply
  let generatedReply: { replyText: string; sentiment: string; suggestedAction: string }
  try {
    let cleaned = textBlock.text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(cleaned.indexOf('\n') + 1)
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3).trim()
      }
    }
    generatedReply = JSON.parse(cleaned) as typeof generatedReply
  } catch {
    throw new Error('Failed to parse review reply JSON from Claude')
  }

  // Update google_reviews with the generated reply
  const { error: updateError } = await supabase
    .from('google_reviews')
    .update({
      reply_content: generatedReply.replyText,
      reply_generated_at: new Date().toISOString(),
      reply_status: 'pending_approval',
    })
    .eq('id', reviewId)

  if (updateError) {
    throw new Error(`Failed to update review: ${updateError.message}`)
  }

  // Also create an ai_contents record for tracking
  const { data: content, error: insertError } = await supabase
    .from('ai_contents')
    .insert({
      site_id: siteId,
      type: 'review_reply',
      content: generatedReply,
      status: 'pending_validation',
      tokens_used: tokensUsed,
      model_used: MODEL,
      reference_id: reviewId,
    })
    .select('id')
    .single()

  if (insertError || !content) {
    throw new Error(`Failed to save ai_content: ${insertError?.message ?? 'unknown'}`)
  }

  // Track token usage
  await supabase.from('token_usage').insert({
    site_id: siteId,
    organization_id: site.organization_id,
    model: MODEL,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    purpose: 'review_reply',
  })

  workerLogger.info('Review reply generated successfully', {
    ...ctx,
    contentId: content.id as string,
    tokensUsed,
  })

  return {
    contentId: content.id as string,
    tokensUsed,
    status: 'pending_validation',
  }
}

// ── Worker instance ──

export const reviewReplyWorker = new Worker<ReviewReplyJobData, ContentGenerationResult>(
  QUEUE_NAMES.REVIEWS,
  processReviewReply,
  {
    connection,
    concurrency: 5,
    limiter: { max: 20, duration: 60_000 },
  },
)

reviewReplyWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    siteId: job.data.siteId,
    reviewId: job.data.reviewId,
  })
})

reviewReplyWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    siteId: job?.data.siteId,
    reviewId: job?.data.reviewId,
    error,
  })
})
