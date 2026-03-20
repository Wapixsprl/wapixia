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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function dashboardRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/dashboard — Aggregate dashboard data
  fastify.get('/api/v1/sites/:siteId/dashboard', async (request, reply) => {
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

    // Verify site access
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, status')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Fetch all dashboard data in parallel
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear

    const [
      visibilityResult,
      currentStatsResult,
      previousStatsResult,
      trendResult,
      pendingContentResult,
      recentLeadsResult,
      modulesResult,
      connectionsResult,
    ] = await Promise.all([
      // Visibility score
      supabase
        .from('visibility_scores')
        .select('score, breakdown, calculated_at')
        .eq('site_id', siteId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Current month stats
      supabase
        .from('monthly_stats')
        .select('visits, leads, content_published, reviews_replied, avg_rating')
        .eq('site_id', siteId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .maybeSingle(),

      // Previous month stats (for deltas)
      supabase
        .from('monthly_stats')
        .select('visits, leads, visibility_score')
        .eq('site_id', siteId)
        .eq('year', previousYear)
        .eq('month', previousMonth)
        .maybeSingle(),

      // Visibility trend (last 6 months)
      supabase
        .from('visibility_scores')
        .select('score, calculated_at')
        .eq('site_id', siteId)
        .order('calculated_at', { ascending: false })
        .limit(6),

      // Pending content count
      supabase
        .from('contents')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .eq('status', 'pending'),

      // Recent leads (last 5)
      supabase
        .from('leads')
        .select('id, type, name, email, phone, status, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(5),

      // Active modules
      supabase
        .from('site_modules')
        .select('module_key')
        .eq('site_id', siteId)
        .eq('enabled', true),

      // Google connections
      supabase
        .from('google_connections')
        .select('service, connected')
        .eq('site_id', siteId),
    ])

    // Compute deltas
    const currentVisits = currentStatsResult.data?.visits ?? 0
    const previousVisits = previousStatsResult.data?.visits ?? 0
    const currentLeads = currentStatsResult.data?.leads ?? 0
    const previousLeads = previousStatsResult.data?.leads ?? 0
    const currentScore = visibilityResult.data?.score ?? 0
    const previousScore = previousStatsResult.data?.visibility_score ?? 0

    function computeDelta(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    // Build google connections map
    const connections = connectionsResult.data ?? []
    const googleConnections = {
      analytics: connections.some((c) => c.service === 'analytics' && c.connected),
      searchConsole: connections.some((c) => c.service === 'search_console' && c.connected),
      gmb: connections.some((c) => c.service === 'gmb' && c.connected),
    }

    return reply.send({
      data: {
        visibilityScore: {
          current: currentScore,
          breakdown: visibilityResult.data?.breakdown ?? null,
          trend: (trendResult.data ?? []).map((t) => ({
            score: t.score,
            date: t.calculated_at,
          })),
        },
        currentMonth: {
          visits: currentVisits,
          leads: currentLeads,
          contentPublished: currentStatsResult.data?.content_published ?? 0,
          reviewsReplied: currentStatsResult.data?.reviews_replied ?? 0,
          avgRating: currentStatsResult.data?.avg_rating ?? null,
        },
        deltas: {
          visits: computeDelta(currentVisits, previousVisits),
          leads: computeDelta(currentLeads, previousLeads),
          visibilityScore: computeDelta(currentScore, previousScore),
        },
        pendingContent: pendingContentResult.count ?? 0,
        recentLeads: recentLeadsResult.data ?? [],
        activeModules: (modulesResult.data ?? []).map((m) => m.module_key),
        googleConnections,
      },
    })
  })
}
