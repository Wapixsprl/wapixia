import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MollieWebhookBody = z.object({
  id: z.string().min(1, 'id requis'),
})

// ---------------------------------------------------------------------------
// Helper: service-role Supabase client (no RLS — webhook has no user JWT)
// ---------------------------------------------------------------------------

function serviceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
}

// ---------------------------------------------------------------------------
// Helper: fetch payment status from Mollie API
// ---------------------------------------------------------------------------

async function fetchMolliePayment(paymentId: string) {
  const res = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${env.MOLLIE_API_KEY}`,
    },
  })
  if (!res.ok) {
    throw new Error(`Mollie API error ${res.status}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Delay helper for retry queue
// ---------------------------------------------------------------------------

function retryDelay(attempt: number): number {
  // Exponential backoff: 1h, 4h, 24h
  const delays = [3600_000, 14400_000, 86400_000]
  return delays[Math.min(attempt - 1, delays.length - 1)]
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function mollieWebhookRoutes(fastify: FastifyInstance) {
  // POST /api/v1/webhooks/mollie — Mollie payment webhook
  // NO auth — Mollie does not send Bearer tokens
  fastify.post(
    '/api/v1/webhooks/mollie',
    {
      config: { skipAuth: true },
    },
    async (request, reply) => {
      // Always return 200 to Mollie regardless of outcome
      const bodyParse = MollieWebhookBody.safeParse(request.body)
      if (!bodyParse.success) {
        fastify.log.warn({ body: request.body }, 'Mollie webhook: body invalide')
        return reply.status(200).send({ received: true })
      }

      const { id: molliePaymentId } = bodyParse.data
      const supabase = serviceClient()

      try {
        // Fetch real payment status from Mollie API (source of truth)
        const molliePayment = await fetchMolliePayment(molliePaymentId)
        const mollieStatus: string = molliePayment.status
        const metadata = molliePayment.metadata as {
          subscriptionId?: string
          siteId?: string
          type?: string
        } | null

        // Idempotency: check if we already processed this status
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id, status, mollie_payment_id')
          .eq('mollie_payment_id', molliePaymentId)
          .maybeSingle()

        if (existingPayment && existingPayment.status === mollieStatus) {
          fastify.log.info({ molliePaymentId, status: mollieStatus }, 'Mollie webhook: déjà traité')
          return reply.status(200).send({ received: true })
        }

        const now = new Date().toISOString()

        // ── Handle: paid ──
        if (mollieStatus === 'paid') {
          // Update payment record
          if (existingPayment) {
            await supabase
              .from('payments')
              .update({
                status: 'paid',
                paid_at: now,
                updated_at: now,
              })
              .eq('id', existingPayment.id)
          } else {
            await supabase
              .from('payments')
              .insert({
                mollie_payment_id: molliePaymentId,
                subscription_id: metadata?.subscriptionId ?? null,
                site_id: metadata?.siteId ?? null,
                amount: molliePayment.amount?.value ?? '0',
                currency: molliePayment.amount?.currency ?? 'EUR',
                status: 'paid',
                type: metadata?.type ?? 'recurring',
                paid_at: now,
                created_at: now,
                updated_at: now,
              })
          }

          // Update subscription to active
          if (metadata?.subscriptionId) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                current_period_start: now,
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: now,
              })
              .eq('id', metadata.subscriptionId)
          }

          // Store mandate for recurring payments
          if (molliePayment.mandateId) {
            await supabase
              .from('subscriptions')
              .update({
                mollie_mandate_id: molliePayment.mandateId,
                mollie_customer_id: molliePayment.customerId ?? null,
                updated_at: now,
              })
              .eq('id', metadata?.subscriptionId)
          }

          // Queue async jobs: invoice generation, commission calculation, confirmation email
          if (metadata?.siteId && existingPayment?.id) {
            // Queue invoice generation
            await supabase.from('job_queue').insert({
              type: 'generate_invoice',
              payload: {
                paymentId: existingPayment.id,
                siteId: metadata.siteId,
              },
              status: 'pending',
              created_at: now,
            })

            // Queue commission calculation
            await supabase.from('job_queue').insert({
              type: 'calculate_commission',
              payload: {
                paymentId: existingPayment.id,
                siteId: metadata.siteId,
                subscriptionId: metadata.subscriptionId,
              },
              status: 'pending',
              created_at: now,
            })

            // Queue confirmation email
            const { data: siteData } = await supabase
              .from('sites')
              .select('owner_user_id')
              .eq('id', metadata.siteId)
              .single()

            if (siteData?.owner_user_id) {
              const { data: userData } = await supabase
                .from('users')
                .select('email, first_name')
                .eq('id', siteData.owner_user_id)
                .single()

              if (userData) {
                await supabase.from('job_queue').insert({
                  type: 'send_email',
                  payload: {
                    templateId: 'payment_confirmation',
                    to: userData.email,
                    toName: userData.first_name ?? '',
                    params: {
                      amount: molliePayment.amount?.value ?? '0',
                      currency: molliePayment.amount?.currency ?? 'EUR',
                    },
                  },
                  status: 'pending',
                  created_at: now,
                })
              }
            }
          }

          fastify.log.info({ molliePaymentId }, 'Mollie webhook: paiement confirmé')
        }

        // ── Handle: failed ──
        else if (mollieStatus === 'failed') {
          const dunningAttempts = existingPayment
            ? ((await supabase
                .from('payments')
                .select('dunning_attempts')
                .eq('id', existingPayment.id)
                .single()).data?.dunning_attempts ?? 0) + 1
            : 1

          if (existingPayment) {
            await supabase
              .from('payments')
              .update({
                status: 'failed',
                dunning_attempts: dunningAttempts,
                updated_at: now,
              })
              .eq('id', existingPayment.id)
          }

          // Queue retry with exponential delay (max 3 attempts)
          if (dunningAttempts <= 3 && metadata?.subscriptionId) {
            await supabase.from('job_queue').insert({
              type: 'retry_payment',
              payload: {
                subscriptionId: metadata.subscriptionId,
                molliePaymentId,
                attempt: dunningAttempts,
              },
              status: 'pending',
              scheduled_for: new Date(Date.now() + retryDelay(dunningAttempts)).toISOString(),
              created_at: now,
            })
          }

          fastify.log.warn({ molliePaymentId, dunningAttempts }, 'Mollie webhook: paiement échoué')
        }

        // ── Handle: expired ──
        else if (mollieStatus === 'expired') {
          if (existingPayment) {
            await supabase
              .from('payments')
              .update({
                status: 'expired',
                updated_at: now,
              })
              .eq('id', existingPayment.id)
          }

          fastify.log.info({ molliePaymentId }, 'Mollie webhook: paiement expiré')
        }

        // ── Handle: canceled ──
        else if (mollieStatus === 'canceled') {
          if (existingPayment) {
            await supabase
              .from('payments')
              .update({
                status: 'canceled',
                updated_at: now,
              })
              .eq('id', existingPayment.id)
          }

          // Also cancel subscription if applicable
          if (metadata?.subscriptionId) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'cancelled',
                cancelled_at: now,
                updated_at: now,
              })
              .eq('id', metadata.subscriptionId)
              .in('status', ['trialing', 'active'])
          }

          fastify.log.info({ molliePaymentId }, 'Mollie webhook: paiement annulé')
        }

        // ── Other statuses (open, pending, authorized) — no action ──
        else {
          fastify.log.debug({ molliePaymentId, status: mollieStatus }, 'Mollie webhook: statut ignoré')
        }
      } catch (err) {
        fastify.log.error({ error: (err as Error).message, molliePaymentId }, 'Mollie webhook: erreur de traitement')
      }

      // Always return 200 to Mollie
      return reply.status(200).send({ received: true })
    },
  )
}
