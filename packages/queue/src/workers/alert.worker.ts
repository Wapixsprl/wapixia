// @wapixia/queue — Alert notification worker

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { AlertJobData, AlertResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'alert'

/** Brevo template IDs for alerts */
const ALERT_TEMPLATES = {
  NEGATIVE_REVIEW: 10,
  CONTENT_READY: 11,
  PUBLISH_FAILED: 12,
  CUSTOM: 13,
} as const

/**
 * Send an email alert via the Brevo API.
 * Uses the same approach as BrevoService in @wapixia/api.
 */
async function sendBrevoEmail(params: {
  templateId: number
  to: string
  toName: string
  templateParams: Record<string, string>
}): Promise<string> {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey || apiKey === 'stub') {
    workerLogger.info('STUB: Sending Brevo email', {
      worker: WORKER_NAME,
      jobId: 'n/a',
    })
    return `brevo-stub-${Date.now()}`
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      templateId: params.templateId,
      to: [{ email: params.to, name: params.toName }],
      params: params.templateParams,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Brevo API error (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as { messageId: string }
  return data.messageId
}

async function processAlert(
  job: Job<AlertJobData>,
): Promise<AlertResult> {
  const { reviewId, type, siteId, message } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, reviewId, siteId }

  workerLogger.info('Processing alert', ctx)

  const supabase = createSupabaseClient()

  // Determine alert type and load context
  if (reviewId) {
    // Alert for a negative review
    const { data: review, error: reviewError } = await supabase
      .from('google_reviews')
      .select('*, sites!inner(id, name, organization_id, owner_user_id)')
      .eq('id', reviewId)
      .single()

    if (reviewError || !review) {
      throw new Error(`Review not found: ${reviewId}`)
    }

    const siteData = review.sites as Record<string, unknown>
    const ownerUserId = String(siteData['owner_user_id'] ?? '')

    // Get the site owner's email
    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('email, first_name, last_name, notif_email')
      .eq('id', ownerUserId)
      .single()

    if (ownerError || !owner) {
      throw new Error(`Site owner not found: ${ownerUserId}`)
    }

    if (!owner.notif_email) {
      workerLogger.info('User has email notifications disabled, skipping', ctx)
      return { alertSent: false }
    }

    const messageId = await sendBrevoEmail({
      templateId: ALERT_TEMPLATES.NEGATIVE_REVIEW,
      to: owner.email as string,
      toName: `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim(),
      templateParams: {
        site_name: String(siteData['name'] ?? ''),
        reviewer_name: String(review.reviewer_name ?? 'Anonyme'),
        rating: String(review.rating ?? ''),
        review_text: String(review.comment ?? ''),
      },
    })

    // Mark alert as sent on the review
    await supabase
      .from('google_reviews')
      .update({ alert_sent: true })
      .eq('id', reviewId)

    workerLogger.info('Negative review alert sent', {
      ...ctx,
      siteId: String(siteData['id'] ?? ''),
    })

    return { alertSent: true, messageId }
  }

  if (type && siteId) {
    // Generic alert by type
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, name, owner_user_id')
      .eq('id', siteId)
      .single()

    if (siteError || !site) {
      throw new Error(`Site not found: ${siteId}`)
    }

    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('email, first_name, last_name, notif_email')
      .eq('id', site.owner_user_id)
      .single()

    if (ownerError || !owner) {
      throw new Error(`Site owner not found: ${site.owner_user_id}`)
    }

    if (!owner.notif_email) {
      workerLogger.info('User has email notifications disabled, skipping', ctx)
      return { alertSent: false }
    }

    const templateId =
      type === 'content_ready'
        ? ALERT_TEMPLATES.CONTENT_READY
        : type === 'publish_failed'
          ? ALERT_TEMPLATES.PUBLISH_FAILED
          : ALERT_TEMPLATES.CUSTOM

    const messageId = await sendBrevoEmail({
      templateId,
      to: owner.email as string,
      toName: `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim(),
      templateParams: {
        site_name: String(site.name),
        alert_type: type,
        message: message ?? '',
      },
    })

    workerLogger.info('Alert sent', { ...ctx, siteId })

    return { alertSent: true, messageId }
  }

  workerLogger.warn('Alert job received with no reviewId or type+siteId', ctx)
  return { alertSent: false }
}

// ── Worker instance ──

export const alertWorker = new Worker<AlertJobData, AlertResult>(
  QUEUE_NAMES.ALERT,
  processAlert,
  {
    connection,
    concurrency: 5,
    limiter: { max: 30, duration: 60_000 },
  },
)

alertWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    reviewId: job.data.reviewId,
    siteId: job.data.siteId,
  })
})

alertWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    reviewId: job?.data.reviewId,
    siteId: job?.data.siteId,
    error,
  })
})
