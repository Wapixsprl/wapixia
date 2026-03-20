// @wapixia/queue — Commission calculation worker

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { CommissionJobData, CommissionResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'commission'

/**
 * Attempt a Stripe Connect transfer for the reseller commission.
 * Calls the API billing service which wraps Stripe.
 */
async function attemptStripeTransfer(params: {
  commissionId: string
  resellerStripeAccountId: string
  amount: number
  currency: string
}): Promise<string | null> {
  const apiBaseUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000'
  const apiKey = process.env.API_INTERNAL_KEY ?? ''

  try {
    const response = await fetch(`${apiBaseUrl}/internal/billing/commissions/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': apiKey,
      },
      body: JSON.stringify({
        commissionId: params.commissionId,
        stripeAccountId: params.resellerStripeAccountId,
        amount: params.amount,
        currency: params.currency,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      workerLogger.warn(`Stripe transfer API error (${response.status}): ${errorText}`, {
        worker: WORKER_NAME,
        jobId: 'n/a',
        commissionId: params.commissionId,
      })
      return null
    }

    const data = (await response.json()) as { transferId: string }
    return data.transferId
  } catch (err) {
    workerLogger.warn('Stripe transfer request failed', {
      worker: WORKER_NAME,
      jobId: 'n/a',
      commissionId: params.commissionId,
      error: err,
    })
    return null
  }
}

async function processCommission(
  job: Job<CommissionJobData>,
): Promise<CommissionResult> {
  const { paymentId } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, paymentId }

  workerLogger.info('Starting commission calculation', ctx)

  const supabase = createSupabaseClient()

  // Load payment with subscription
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, subscription_id, organization_id, amount, currency, status')
    .eq('id', paymentId)
    .single()

  if (paymentError || !payment) {
    throw new Error(`Payment not found: ${paymentId}`)
  }

  // Only process paid payments
  if (payment.status !== 'paid') {
    workerLogger.info('Payment not in paid status, skipping commission', {
      ...ctx,
      paymentStatus: payment.status as string,
    })
    return { paymentId, skipped: true, reason: 'payment_not_paid' }
  }

  // Check for existing commission (idempotency)
  const { data: existingCommission } = await supabase
    .from('commissions')
    .select('id')
    .eq('payment_id', paymentId)
    .limit(1)

  if (existingCommission && existingCommission.length > 0) {
    workerLogger.info('Commission already exists for payment, skipping', ctx)
    return {
      paymentId,
      commissionId: existingCommission[0].id as string,
      skipped: true,
      reason: 'already_exists',
    }
  }

  // Load subscription to find the site
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('id, site_id, organization_id, current_period_start, current_period_end')
    .eq('id', payment.subscription_id)
    .single()

  if (subError || !subscription) {
    throw new Error(`Subscription not found: ${payment.subscription_id}`)
  }

  // Load the organization to check if it's a reseller
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, type, stripe_account_id, commission_rate, parent_id')
    .eq('id', subscription.organization_id)
    .single()

  if (orgError || !org) {
    throw new Error(`Organization not found: ${subscription.organization_id}`)
  }

  // Determine if there's a reseller in the chain
  let resellerId: string | null = null
  let resellerStripeAccountId: string | null = null
  let commissionRate = 0

  if (org.type === 'reseller' && org.stripe_account_id) {
    // The org itself is a reseller
    resellerId = org.id as string
    resellerStripeAccountId = org.stripe_account_id as string
    commissionRate = parseFloat(String(org.commission_rate ?? '20.00'))
  } else if (org.parent_id) {
    // Check if parent is a reseller
    const { data: parentOrg } = await supabase
      .from('organizations')
      .select('id, type, stripe_account_id, commission_rate')
      .eq('id', org.parent_id)
      .single()

    if (parentOrg?.type === 'reseller' && parentOrg.stripe_account_id) {
      resellerId = parentOrg.id as string
      resellerStripeAccountId = parentOrg.stripe_account_id as string
      commissionRate = parseFloat(String(parentOrg.commission_rate ?? '20.00'))
    }
  }

  // No reseller — client direct, skip commission
  if (!resellerId || !resellerStripeAccountId) {
    workerLogger.info('No reseller in chain, skipping commission', ctx)
    return { paymentId, skipped: true, reason: 'no_reseller' }
  }

  // Calculate commission
  const baseAmount = parseFloat(String(payment.amount))
  const commissionAmount = Math.round((baseAmount * commissionRate) / 100 * 100) / 100

  workerLogger.info('Calculated commission', {
    ...ctx,
    resellerId,
    baseAmount: String(baseAmount),
    commissionRate: String(commissionRate),
    commissionAmount: String(commissionAmount),
  })

  // Insert commission record
  const { data: commission, error: insertError } = await supabase
    .from('commissions')
    .insert({
      reseller_id: resellerId,
      payment_id: paymentId,
      site_id: subscription.site_id,
      base_amount: String(baseAmount),
      commission_rate: String(commissionRate),
      commission_amount: String(commissionAmount),
      status: 'pending',
      period_start: subscription.current_period_start ?? new Date().toISOString(),
      period_end: subscription.current_period_end ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !commission) {
    throw new Error(`Failed to insert commission: ${insertError?.message ?? 'unknown'}`)
  }

  const commissionId = commission.id as string

  // Attempt Stripe transfer
  const transferId = await attemptStripeTransfer({
    commissionId,
    resellerStripeAccountId,
    amount: Math.round(commissionAmount * 100), // Stripe uses cents
    currency: (payment.currency as string) ?? 'EUR',
  })

  if (transferId) {
    // Update commission with transfer ID and mark as paid
    await supabase
      .from('commissions')
      .update({
        stripe_transfer_id: transferId,
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commissionId)

    workerLogger.info('Commission paid via Stripe transfer', {
      ...ctx,
      commissionId,
      transferId,
    })
  } else {
    // Mark as processing — will be retried or handled manually
    await supabase
      .from('commissions')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', commissionId)

    workerLogger.warn('Stripe transfer failed, commission marked as processing', {
      ...ctx,
      commissionId,
    })
  }

  return { paymentId, commissionId, skipped: false }
}

// ── Worker instance ──

export const commissionWorker = new Worker<CommissionJobData, CommissionResult>(
  QUEUE_NAMES.COMMISSION,
  processCommission,
  {
    connection,
    concurrency: 3,
    limiter: { max: 15, duration: 60_000 },
  },
)

commissionWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    paymentId: job.data.paymentId,
  })
})

commissionWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    paymentId: job?.data.paymentId,
    error,
  })
})
