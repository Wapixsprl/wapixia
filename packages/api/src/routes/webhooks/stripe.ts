import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../../env.js'

// ---------------------------------------------------------------------------
// Helper: service-role Supabase client (no RLS — webhook has no user JWT)
// ---------------------------------------------------------------------------

function serviceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
}

// ---------------------------------------------------------------------------
// Helper: validate Stripe webhook signature (HMAC SHA-256)
// ---------------------------------------------------------------------------

function verifyStripeSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  try {
    const elements = signatureHeader.split(',')
    const timestampElement = elements.find((e) => e.startsWith('t='))
    const signatureElement = elements.find((e) => e.startsWith('v1='))

    if (!timestampElement || !signatureElement) return false

    const timestamp = timestampElement.slice(2)
    const expectedSignature = signatureElement.slice(3)

    // Check timestamp tolerance (5 minutes)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false

    const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`
    const computedSignature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    const computedBuffer = Buffer.from(computedSignature, 'hex')

    if (expectedBuffer.length !== computedBuffer.length) return false

    return timingSafeEqual(expectedBuffer, computedBuffer)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  // Register a raw body content type parser for this plugin scope
  // This captures the raw buffer before JSON parsing for HMAC verification
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_request, body, done) => {
      // Store raw body on the request for later HMAC verification
      ;(_request as any).rawBody = body
      try {
        const json = JSON.parse(body.toString('utf8'))
        done(null, json)
      } catch (err) {
        done(err as Error, undefined)
      }
    },
  )

  // POST /api/v1/webhooks/stripe — Stripe webhook handler
  // NO Bearer auth — uses HMAC signature validation instead
  fastify.post(
    '/api/v1/webhooks/stripe',
    {
      config: { skipAuth: true },
    },
    async (request, reply) => {
      const signatureHeader = request.headers['stripe-signature'] as string | undefined

      if (!signatureHeader) {
        return reply.status(400).send({
          error: { code: 'INVALID_SIGNATURE', message: 'Signature Stripe manquante' },
        })
      }

      // Get raw body for signature verification
      const rawBody = (request as any).rawBody as Buffer | undefined
      if (!rawBody) {
        return reply.status(400).send({
          error: { code: 'INVALID_BODY', message: 'Corps de la requête invalide' },
        })
      }

      // Validate HMAC signature
      if (!verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET ?? '')) {
        fastify.log.warn('Stripe webhook: signature invalide')
        return reply.status(400).send({
          error: { code: 'INVALID_SIGNATURE', message: 'Signature Stripe invalide' },
        })
      }

      const event = request.body as {
        id: string
        type: string
        data: {
          object: {
            id: string
            status?: string
            amount?: number
            currency?: string
            destination?: string
            metadata?: Record<string, string>
            failure_message?: string
          }
        }
      }

      const supabase = serviceClient()
      const now = new Date().toISOString()

      // ── Handle: transfer.created ──
      if (event.type === 'transfer.created') {
        const transfer = event.data.object

        await supabase.from('commission_transfers').upsert(
          {
            stripe_transfer_id: transfer.id,
            stripe_account_id: transfer.destination ?? null,
            amount: transfer.amount ? (transfer.amount / 100).toFixed(2) : '0',
            currency: transfer.currency ?? 'eur',
            status: 'created',
            metadata: transfer.metadata ?? {},
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'stripe_transfer_id' },
        )

        // Update related commission record if metadata contains commission_id
        if (transfer.metadata?.commission_id) {
          await supabase
            .from('commissions')
            .update({
              transfer_status: 'created',
              stripe_transfer_id: transfer.id,
              updated_at: now,
            })
            .eq('id', transfer.metadata.commission_id)
        }

        fastify.log.info({ transferId: transfer.id }, 'Stripe webhook: transfert créé')
      }

      // ── Handle: transfer.failed ──
      else if (event.type === 'transfer.failed') {
        const transfer = event.data.object

        await supabase
          .from('commission_transfers')
          .update({
            status: 'failed',
            failure_message: transfer.failure_message ?? null,
            updated_at: now,
          })
          .eq('stripe_transfer_id', transfer.id)

        // Update related commission record
        if (transfer.metadata?.commission_id) {
          await supabase
            .from('commissions')
            .update({
              transfer_status: 'failed',
              updated_at: now,
            })
            .eq('id', transfer.metadata.commission_id)
        }

        fastify.log.warn({ transferId: transfer.id }, 'Stripe webhook: transfert échoué')
      }

      // ── Unhandled event type ──
      else {
        fastify.log.debug({ eventType: event.type }, 'Stripe webhook: événement ignoré')
      }

      return reply.status(200).send({ received: true })
    },
  )
}
