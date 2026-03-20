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

export async function competitorsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/competitors — List detected competitors
  fastify.get('/api/v1/sites/:siteId/competitors', async (request, reply) => {
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

    const { data: competitors, error } = await supabase
      .from('competitors')
      .select(
        'id, name, domain, gmb_place_id, avg_rating, review_count, visibility_score, last_checked_at, created_at'
      )
      .eq('site_id', siteId)
      .order('visibility_score', { ascending: false })

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération concurrents')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: (competitors ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        domain: c.domain,
        gmbPlaceId: c.gmb_place_id,
        avgRating: c.avg_rating,
        reviewCount: c.review_count,
        visibilityScore: c.visibility_score,
        lastCheckedAt: c.last_checked_at,
        createdAt: c.created_at,
      })),
      meta: { total: competitors?.length ?? 0 },
    })
  })
}
