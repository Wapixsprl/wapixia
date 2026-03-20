import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'
import { requireRole } from '../../plugins/auth.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'calculated', 'transferred', 'failed']).optional(),
})

const ProcessCommissionsBody = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2024).max(2100),
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
// Helper: service-role Supabase client (for admin operations)
// ---------------------------------------------------------------------------

function serviceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function commissionRoutes(fastify: FastifyInstance) {
  // GET /api/v1/reseller/commissions — List commissions for current reseller
  fastify.get(
    '/api/v1/reseller/commissions',
    {
      preHandler: requireRole(['reseller_admin', 'reseller_user', 'superadmin']),
    },
    async (request, reply) => {
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

      const { page, limit, status } = queryParse.data
      const supabase = rlsClient(request.headers.authorization ?? '')
      const organizationId = request.user.organizationId

      // Build query
      let countQuery = supabase
        .from('commissions')
        .select('id', { count: 'exact', head: true })
        .eq('reseller_organization_id', organizationId)

      let dataQuery = supabase
        .from('commissions')
        .select('*')
        .eq('reseller_organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (status) {
        countQuery = countQuery.eq('status', status)
        dataQuery = dataQuery.eq('status', status)
      }

      const { count, error: countError } = await countQuery

      if (countError) {
        fastify.log.error({ error: countError.message }, 'Erreur comptage commissions')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
        })
      }

      const total = count ?? 0
      const offset = (page - 1) * limit

      const { data: commissions, error: commError } = await dataQuery.range(offset, offset + limit - 1)

      if (commError) {
        fastify.log.error({ error: commError.message }, 'Erreur récupération commissions')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
        })
      }

      return reply.send({
        data: commissions ?? [],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    },
  )

  // GET /api/v1/reseller/mrr — Total MRR for current reseller
  fastify.get(
    '/api/v1/reseller/mrr',
    {
      preHandler: requireRole(['reseller_admin', 'reseller_user', 'superadmin']),
    },
    async (request, reply) => {
      const supabase = rlsClient(request.headers.authorization ?? '')
      const organizationId = request.user.organizationId

      // Fetch all active subscriptions for sites under this reseller's organization
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('amount_ht, amount_ttc')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing'])

      if (subError) {
        fastify.log.error({ error: subError.message }, 'Erreur calcul MRR')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
        })
      }

      const mrrHT = (subscriptions ?? []).reduce(
        (sum, s) => sum + parseFloat(s.amount_ht ?? '0'),
        0,
      )
      const mrrTTC = (subscriptions ?? []).reduce(
        (sum, s) => sum + parseFloat(s.amount_ttc ?? '0'),
        0,
      )

      // Fetch commission rate for this organization
      const { data: org } = await supabase
        .from('organizations')
        .select('commission_rate')
        .eq('id', organizationId)
        .single()

      const commissionRate = parseFloat(org?.commission_rate ?? '20.00')
      const estimatedCommission = Math.round(mrrHT * (commissionRate / 100) * 100) / 100

      return reply.send({
        data: {
          mrrHT: Math.round(mrrHT * 100) / 100,
          mrrTTC: Math.round(mrrTTC * 100) / 100,
          activeSubscriptions: subscriptions?.length ?? 0,
          commissionRate,
          estimatedMonthlyCommission: estimatedCommission,
        },
      })
    },
  )

  // GET /api/v1/admin/commissions — All commissions (superadmin only)
  fastify.get(
    '/api/v1/admin/commissions',
    {
      preHandler: requireRole(['superadmin']),
    },
    async (request, reply) => {
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

      const { page, limit, status } = queryParse.data
      const supabase = serviceClient()

      // Count
      let countQuery = supabase
        .from('commissions')
        .select('id', { count: 'exact', head: true })

      if (status) {
        countQuery = countQuery.eq('status', status)
      }

      const { count, error: countError } = await countQuery

      if (countError) {
        fastify.log.error({ error: countError.message }, 'Erreur comptage commissions admin')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
        })
      }

      const total = count ?? 0
      const offset = (page - 1) * limit

      // Data query with reseller info
      let dataQuery = supabase
        .from('commissions')
        .select('*, organizations!reseller_organization_id(id, name, slug)')
        .order('created_at', { ascending: false })

      if (status) {
        dataQuery = dataQuery.eq('status', status)
      }

      const { data: commissions, error: commError } = await dataQuery.range(offset, offset + limit - 1)

      if (commError) {
        fastify.log.error({ error: commError.message }, 'Erreur récupération commissions admin')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
        })
      }

      return reply.send({
        data: commissions ?? [],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    },
  )

  // POST /api/v1/admin/commissions/process — Trigger monthly commission calculation
  fastify.post(
    '/api/v1/admin/commissions/process',
    {
      preHandler: requireRole(['superadmin']),
    },
    async (request, reply) => {
      const bodyParse = ProcessCommissionsBody.safeParse(request.body)
      if (!bodyParse.success) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données invalides',
            details: bodyParse.error.flatten().fieldErrors,
          },
        })
      }

      const { month, year } = bodyParse.data
      const supabase = serviceClient()
      const now = new Date().toISOString()

      // Check if commissions already processed for this period
      const { data: existing } = await supabase
        .from('commissions')
        .select('id')
        .eq('period_month', month)
        .eq('period_year', year)
        .limit(1)

      if (existing && existing.length > 0) {
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: `Les commissions pour ${month}/${year} ont déjà été calculées`,
          },
        })
      }

      // Fetch all reseller organizations with active subscriptions
      const { data: resellers, error: resellerError } = await supabase
        .from('organizations')
        .select('id, name, commission_rate, stripe_account_id')
        .eq('type', 'reseller')
        .eq('status', 'active')

      if (resellerError) {
        fastify.log.error({ error: resellerError.message }, 'Erreur récupération revendeurs')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
        })
      }

      const commissions: Array<{
        resellerId: string
        resellerName: string
        amountHT: number
        commissionRate: number
        commissionAmount: number
      }> = []

      for (const reseller of resellers ?? []) {
        // Get paid payments for this reseller's sites in the given month
        const periodStart = new Date(year, month - 1, 1).toISOString()
        const periodEnd = new Date(year, month, 1).toISOString()

        const { data: payments } = await supabase
          .from('payments')
          .select('amount, subscriptions!inner(organization_id)')
          .eq('status', 'paid')
          .eq('subscriptions.organization_id', reseller.id)
          .gte('paid_at', periodStart)
          .lt('paid_at', periodEnd)

        if (!payments || payments.length === 0) continue

        const totalPaid = payments.reduce(
          (sum, p) => sum + parseFloat(p.amount ?? '0'),
          0,
        )

        const rate = parseFloat(reseller.commission_rate ?? '20.00')
        const commissionAmount = Math.round(totalPaid * (rate / 100) * 100) / 100

        // Insert commission record
        const { error: insertError } = await supabase.from('commissions').insert({
          reseller_organization_id: reseller.id,
          period_month: month,
          period_year: year,
          total_revenue: totalPaid.toFixed(2),
          commission_rate: rate.toFixed(2),
          commission_amount: commissionAmount.toFixed(2),
          status: 'calculated',
          stripe_account_id: reseller.stripe_account_id ?? null,
          created_at: now,
          updated_at: now,
        })

        if (insertError) {
          fastify.log.error(
            { error: insertError.message, resellerId: reseller.id },
            'Erreur insertion commission',
          )
          continue
        }

        commissions.push({
          resellerId: reseller.id,
          resellerName: reseller.name,
          amountHT: totalPaid,
          commissionRate: rate,
          commissionAmount,
        })
      }

      return reply.status(201).send({
        data: {
          period: `${month}/${year}`,
          processedResellers: commissions.length,
          totalCommissions: commissions.reduce((sum, c) => sum + c.commissionAmount, 0),
          details: commissions,
        },
      })
    },
  )
}
