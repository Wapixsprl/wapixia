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

const StatsQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

const HistoryQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function statsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/stats?year=2026&month=3 — Specific month stats
  fastify.get('/api/v1/sites/:siteId/stats', async (request, reply) => {
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

    const queryResult = StatsQuerySchema.safeParse(request.query)
    if (!queryResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres de requête invalides (year et month requis)',
          details: queryResult.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsResult.data
    const { year, month } = queryResult.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: stats, error } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('site_id', siteId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération stats mensuelles')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    if (!stats) {
      return reply.send({
        data: {
          year,
          month,
          visits: 0,
          leads: 0,
          contentPublished: 0,
          reviewsReplied: 0,
          avgRating: null,
          visibilityScore: null,
        },
      })
    }

    return reply.send({
      data: {
        year: stats.year,
        month: stats.month,
        visits: stats.visits,
        leads: stats.leads,
        contentPublished: stats.content_published,
        reviewsReplied: stats.reviews_replied,
        avgRating: stats.avg_rating,
        visibilityScore: stats.visibility_score,
      },
    })
  })

  // GET /api/v1/sites/:siteId/stats/history?months=12 — Stats history
  fastify.get('/api/v1/sites/:siteId/stats/history', async (request, reply) => {
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

    const queryResult = HistoryQuerySchema.safeParse(request.query)
    if (!queryResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètre months invalide',
          details: queryResult.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsResult.data
    const { months } = queryResult.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Calculate the start date
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth() + 1

    const { data: stats, error } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('site_id', siteId)
      .or(
        `and(year.gt.${startYear},year.lte.${now.getFullYear()}),and(year.eq.${startYear},month.gte.${startMonth})`
      )
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération historique stats')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: (stats ?? []).map((s) => ({
        year: s.year,
        month: s.month,
        visits: s.visits,
        leads: s.leads,
        contentPublished: s.content_published,
        reviewsReplied: s.reviews_replied,
        avgRating: s.avg_rating,
        visibilityScore: s.visibility_score,
      })),
      meta: { months, total: stats?.length ?? 0 },
    })
  })
}
