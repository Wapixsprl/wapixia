// @wapixia/queue — Dunning retry worker

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { DunningJobData, DunningResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'dunning'

/**
 * Dunning schedule: retry intervals after first failure.
 * J+1, J+7, J+14, J+30 — after 4 attempts, cancel the subscription.
 */
const DUNNING_SCHEDULE_DAYS = [1, 7, 14, 30] as const
const MAX_DUNNING_ATTEMPTS = DUNNING_SCHEDULE_DAYS.length

/**
 * Call the API dunning service to retry a payment via Mollie.
 */
async function callDunningService(subscriptionId: string): Promise<{
  success: boolean
  externalPaymentId?: string
}> {
  const apiBaseUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000'
  const apiKey = process.env.API_INTERNAL_KEY ?? ''

  const response = await fetch(`${apiBaseUrl}/internal/billing/dunning/retry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': apiKey,
    },
    body: JSON.stringify({ subscriptionId }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Dunning API error (${response.status}): ${errorText}`)
  }

  return (await response.json()) as { success: boolean; externalPaymentId?: string }
}

async function processDunning(
  job: Job<DunningJobData>,
): Promise<DunningResult> {
  const { subscriptionId } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, subscriptionId }

  workerLogger.info('Starting dunning retry', ctx)

  const supabase = createSupabaseClient()

  // Load subscription
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('id, status, dunning_attempts, last_dunning_at, organization_id, site_id')
    .eq('id', subscriptionId)
    .single()

  if (subError || !subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`)
  }

  // Only process subscriptions in past_due or unpaid status
  if (!['past_due', 'unpaid'].includes(subscription.status as string)) {
    workerLogger.info('Subscription not in dunning-eligible status, skipping', {
      ...ctx,
      status: subscription.status as string,
    })
    return { subscriptionId, action: 'skipped' }
  }

  const currentAttempt = (subscription.dunning_attempts as number) ?? 0

  // If max attempts exceeded, cancel the subscription
  if (currentAttempt >= MAX_DUNNING_ATTEMPTS) {
    workerLogger.info('Max dunning attempts reached, cancelling subscription', {
      ...ctx,
      attempts: currentAttempt,
    })

    await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: 'dunning_exhausted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)

    // Also suspend the site
    if (subscription.site_id) {
      await supabase
        .from('sites')
        .update({
          status: 'suspended',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.site_id)
    }

    return { subscriptionId, action: 'cancelled', attempt: currentAttempt }
  }

  // Check if enough time has passed since last dunning attempt
  if (subscription.last_dunning_at && currentAttempt > 0) {
    const lastDunning = new Date(subscription.last_dunning_at as string)
    const daysSinceLastDunning = (Date.now() - lastDunning.getTime()) / (1000 * 60 * 60 * 24)
    const requiredDays = currentAttempt < DUNNING_SCHEDULE_DAYS.length
      ? DUNNING_SCHEDULE_DAYS[currentAttempt] - (DUNNING_SCHEDULE_DAYS[currentAttempt - 1] ?? 0)
      : 0

    if (daysSinceLastDunning < requiredDays) {
      workerLogger.info('Not enough time since last dunning attempt, skipping', {
        ...ctx,
        daysSinceLastDunning: String(Math.round(daysSinceLastDunning)),
        requiredDays: String(requiredDays),
      })
      return { subscriptionId, action: 'skipped', attempt: currentAttempt }
    }
  }

  // Attempt the retry via API
  const result = await callDunningService(subscriptionId)

  // Update subscription dunning state
  const newAttempt = currentAttempt + 1

  if (result.success) {
    // Payment succeeded — resolve dunning
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        dunning_attempts: newAttempt,
        last_dunning_at: new Date().toISOString(),
        dunning_resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)

    workerLogger.info('Dunning retry succeeded, subscription reactivated', {
      ...ctx,
      attempt: newAttempt,
    })

    return { subscriptionId, action: 'retried', attempt: newAttempt }
  }

  // Payment failed — increment attempt counter
  const newStatus = newAttempt >= MAX_DUNNING_ATTEMPTS ? 'unpaid' : 'past_due'

  await supabase
    .from('subscriptions')
    .update({
      status: newStatus,
      dunning_attempts: newAttempt,
      last_dunning_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  workerLogger.warn('Dunning retry failed', {
    ...ctx,
    attempt: newAttempt,
    newStatus,
  })

  return { subscriptionId, action: 'retried', attempt: newAttempt }
}

// ── Worker instance ──

export const dunningWorker = new Worker<DunningJobData, DunningResult>(
  QUEUE_NAMES.DUNNING,
  processDunning,
  {
    connection,
    concurrency: 2,
    limiter: { max: 10, duration: 60_000 },
  },
)

dunningWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    subscriptionId: job.data.subscriptionId,
  })
})

dunningWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    subscriptionId: job?.data.subscriptionId,
    error,
  })
})
