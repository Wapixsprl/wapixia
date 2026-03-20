import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'

// ---------------------------------------------------------------------------
// Helper: create RLS-scoped Supabase client
// ---------------------------------------------------------------------------

function rlsClient(authorization: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  })
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SiteIdParamsSchema = z.object({
  siteId: z.string().uuid('siteId invalide'),
})

const LeadsQuerySchema = z.object({
  type: z
    .enum(['contact_form', 'phone_call', 'chat', 'booking', 'quote_request'])
    .optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function leadsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/leads — List leads with filters + pagination
  fastify.get('/api/v1/sites/:siteId/leads', async (request, reply) => {
    const paramsResult = SiteIdParamsSchema.safeParse(request.params)
    if (!paramsResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsResult.error.flatten().fieldErrors,
        },
      })
    }

    const queryResult = LeadsQuerySchema.safeParse(request.query)
    if (!queryResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres de requête invalides',
          details: queryResult.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsResult.data
    const { type, status, page, limit } = queryResult.data
    const offset = (page - 1) * limit
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Build query
    let query = supabase
      .from('leads')
      .select('id, type, name, email, phone, message, status, source, created_at, updated_at', {
        count: 'exact',
      })
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data: leads, error, count } = await query

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération leads')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    const total = count ?? 0

    return reply.send({
      data: leads ?? [],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  })

  // GET /api/v1/sites/:siteId/leads/stats — Lead stats (by type, by month)
  fastify.get('/api/v1/sites/:siteId/leads/stats', async (request, reply) => {
    const paramsResult = SiteIdParamsSchema.safeParse(request.params)
    if (!paramsResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsResult.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsResult.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Fetch all leads for aggregation (limited to last 12 months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const { data: leads, error } = await supabase
      .from('leads')
      .select('type, status, created_at')
      .eq('site_id', siteId)
      .gte('created_at', twelveMonthsAgo.toISOString())

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération stats leads')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    const allLeads = leads ?? []

    // Aggregate by type
    const byType: Record<string, number> = {}
    for (const lead of allLeads) {
      byType[lead.type] = (byType[lead.type] ?? 0) + 1
    }

    // Aggregate by status
    const byStatus: Record<string, number> = {}
    for (const lead of allLeads) {
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1
    }

    // Aggregate by month
    const byMonth: Record<string, number> = {}
    for (const lead of allLeads) {
      const date = new Date(lead.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      byMonth[key] = (byMonth[key] ?? 0) + 1
    }

    // Sort byMonth chronologically
    const sortedByMonth = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))

    return reply.send({
      data: {
        total: allLeads.length,
        byType,
        byStatus,
        byMonth: sortedByMonth,
      },
    })
  })
}
