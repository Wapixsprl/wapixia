import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SiteIdParams = z.object({
  siteId: z.string().uuid('siteId invalide'),
})

const PaymentParams = z.object({
  siteId: z.string().uuid('siteId invalide'),
  paymentId: z.string().uuid('paymentId invalide'),
})

const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ---------------------------------------------------------------------------
// Helper: create RLS-scoped Supabase client
// ---------------------------------------------------------------------------

function rlsClient(authorization: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  })
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function paymentRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/payments — Paginated payment history
  fastify.get('/api/v1/sites/:siteId/payments', async (request, reply) => {
    const paramsParse = SiteIdParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const queryParse = PaginationQuery.safeParse(request.query)
    if (!queryParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres de pagination invalides',
          details: queryParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsParse.data
    const { page, limit } = queryParse.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access via RLS
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Count total
    const { count, error: countError } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)

    if (countError) {
      fastify.log.error({ error: countError.message }, 'Erreur comptage paiements')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    const total = count ?? 0
    const offset = (page - 1) * limit

    // Fetch paginated payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (paymentsError) {
      fastify.log.error({ error: paymentsError.message }, 'Erreur récupération paiements')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: payments ?? [],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  })

  // GET /api/v1/sites/:siteId/payments/:paymentId/invoice — Returns invoice PDF URL
  fastify.get('/api/v1/sites/:siteId/payments/:paymentId/invoice', async (request, reply) => {
    const paramsParse = PaymentParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, paymentId } = paramsParse.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access via RLS
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Fetch payment with invoice info
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, invoice_url, invoice_number, status')
      .eq('id', paymentId)
      .eq('site_id', siteId)
      .single()

    if (paymentError || !payment) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Paiement introuvable' },
      })
    }

    if (!payment.invoice_url) {
      return reply.status(404).send({
        error: {
          code: 'INVOICE_NOT_AVAILABLE',
          message: "La facture n'est pas encore disponible pour ce paiement",
        },
      })
    }

    return reply.send({
      data: {
        paymentId: payment.id,
        invoiceNumber: payment.invoice_number,
        invoiceUrl: payment.invoice_url,
      },
    })
  })
}
