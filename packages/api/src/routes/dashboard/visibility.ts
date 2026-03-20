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

export async function visibilityRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/visibility-score — Current score + breakdown
  fastify.get('/api/v1/sites/:siteId/visibility-score', async (request, reply) => {
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

    // Get the latest visibility score
    const { data: score, error } = await supabase
      .from('visibility_scores')
      .select('id, score, breakdown, factors, recommendations, calculated_at')
      .eq('site_id', siteId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération score de visibilité')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    if (!score) {
      return reply.send({
        data: {
          score: null,
          breakdown: null,
          factors: null,
          recommendations: [],
          calculatedAt: null,
          message: 'Aucun score de visibilité calculé pour ce site',
        },
      })
    }

    return reply.send({
      data: {
        score: score.score,
        breakdown: score.breakdown,
        factors: score.factors,
        recommendations: score.recommendations ?? [],
        calculatedAt: score.calculated_at,
      },
    })
  })
}
