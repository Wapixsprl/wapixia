// @wapixia/queue — Monthly recurring billing worker

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { BillingRecurringJobData, BillingRecurringResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'
import { invoiceQueue, commissionQueue } from '../queues.js'

const WORKER_NAME = 'billing-recurring'

/**
 * Create a Mollie recurring charge via the API billing service.
 * Returns the external payment ID and status.
 */
async function createMollieRecurringCharge(params: {
  subscriptionId: string
  amount: string
  currency: string
  mollieCustomerId?: string
  mollieMandateId?: string
}): Promise<{
  externalPaymentId: string
  status: string
}> {
  const apiBaseUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000'
  const apiKey = process.env.API_INTERNAL_KEY ?? ''

  const response = await fetch(`${apiBaseUrl}/internal/billing/recurring/charge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': apiKey,
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mollie recurring charge API error (${response.status}): ${errorText}`)
  }

  return (await response.json()) as { externalPaymentId: string; status: string }
}

/**
 * Calculate next billing date based on billing cycle.
 */
function calculateNextBillingDate(currentDate: Date, billingCycle: string): Date {
  const next = new Date(currentDate)

  if (billingCycle === 'yearly') {
    next.setFullYear(next.getFullYear() + 1)
  } else {
    // monthly
    next.setMonth(next.getMonth() + 1)
  }

  return next
}

async function processBillingRecurring(
  job: Job<BillingRecurringJobData>,
): Promise<BillingRecurringResult> {
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId }

  workerLogger.info('Starting recurring billing run', ctx)

  const supabase = createSupabaseClient()
  const now = new Date().toISOString()

  // Find all active subscriptions due for billing
  let query = supabase
    .from('subscriptions')
    .select('id, site_id, organization_id, amount, currency, billing_cycle, payment_provider, mollie_mandate_id, next_billing_date, current_period_start, current_period_end')
    .eq('status', 'active')
    .lte('next_billing_date', now)
    .order('next_billing_date', { ascending: true })
    .limit(100)

  if (job.data.organizationId) {
    query = query.eq('organization_id', job.data.organizationId)
  }

  const { data: subscriptions, error: fetchError } = await query

  if (fetchError) {
    throw new Error(`Failed to fetch due subscriptions: ${fetchError.message}`)
  }

  if (!subscriptions || subscriptions.length === 0) {
    workerLogger.info('No subscriptions due for billing', ctx)
    return { processed: 0, failed: 0 }
  }

  workerLogger.info(`Found ${subscriptions.length} subscriptions due for billing`, ctx)

  let processed = 0
  let failed = 0

  for (const sub of subscriptions) {
    const subCtx = {
      ...ctx,
      subscriptionId: sub.id as string,
      siteId: sub.site_id as string,
    }

    try {
      // Create the recurring charge
      const chargeResult = await createMollieRecurringCharge({
        subscriptionId: sub.id as string,
        amount: String(sub.amount),
        currency: (sub.currency as string) ?? 'EUR',
        mollieMandateId: sub.mollie_mandate_id as string | undefined,
      })

      // Determine payment status
      const paymentStatus = chargeResult.status === 'paid' ? 'paid' : 'pending'

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          subscription_id: sub.id,
          organization_id: sub.organization_id,
          amount: sub.amount,
          currency: sub.currency ?? 'EUR',
          status: paymentStatus,
          payment_provider: sub.payment_provider ?? 'mollie',
          external_payment_id: chargeResult.externalPaymentId,
          paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
        })
        .select('id')
        .single()

      if (paymentError || !payment) {
        throw new Error(`Failed to create payment record: ${paymentError?.message ?? 'unknown'}`)
      }

      // Calculate next billing date
      const currentBillingDate = new Date(sub.next_billing_date as string)
      const nextBillingDate = calculateNextBillingDate(
        currentBillingDate,
        (sub.billing_cycle as string) ?? 'monthly',
      )

      // Update subscription period and next billing date
      await supabase
        .from('subscriptions')
        .update({
          current_period_start: currentBillingDate.toISOString(),
          current_period_end: nextBillingDate.toISOString(),
          next_billing_date: nextBillingDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id)

      // Queue invoice generation
      await invoiceQueue.add('generate-invoice', {
        paymentId: payment.id as string,
      }, {
        jobId: `invoice-${payment.id}-${Date.now()}`,
      })

      // Queue commission calculation (if payment was successful)
      if (paymentStatus === 'paid') {
        await commissionQueue.add('calculate-commission', {
          paymentId: payment.id as string,
        }, {
          jobId: `commission-${payment.id}-${Date.now()}`,
        })
      }

      workerLogger.info('Recurring charge processed', {
        ...subCtx,
        paymentId: payment.id as string,
        paymentStatus,
      })

      processed++
    } catch (err) {
      failed++

      workerLogger.error('Failed to process recurring charge', {
        ...subCtx,
        error: err,
      })

      // Mark subscription as past_due on charge failure
      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          dunning_attempts: 0,
          last_dunning_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id)
    }
  }

  workerLogger.info('Recurring billing run complete', {
    ...ctx,
    processed: String(processed),
    failed: String(failed),
  })

  return { processed, failed }
}

// ── Worker instance ──

export const billingRecurringWorker = new Worker<BillingRecurringJobData, BillingRecurringResult>(
  QUEUE_NAMES.BILLING_RECURRING,
  processBillingRecurring,
  {
    connection,
    concurrency: 1, // Only one billing run at a time
    limiter: { max: 2, duration: 60_000 },
  },
)

billingRecurringWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
  })
})

billingRecurringWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    error,
  })
})
