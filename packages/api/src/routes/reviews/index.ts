import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { env } from '../../env.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SiteIdParams = z.object({
  siteId: z.string().uuid('siteId invalide'),
})

const ReviewParams = z.object({
  siteId: z.string().uuid('siteId invalide'),
  reviewId: z.string().uuid('reviewId invalide'),
})

const ListReviewsQuery = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  status: z
    .enum(['pending', 'replied', 'skipped'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const ApproveReplyBody = z.object({
  editedReply: z.string().max(5000).optional(),
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

export async function reviewsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/reviews — List reviews with filters
  fastify.get('/api/v1/sites/:siteId/reviews', async (request, reply) => {
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

    const queryParse = ListReviewsQuery.safeParse(request.query)
    if (!queryParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres de requête invalides',
          details: queryParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsParse.data
    const { rating, status, page, limit } = queryParse.data
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

    // Build query
    let query = supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('site_id', siteId)

    if (rating !== undefined) query = query.eq('rating', rating)
    if (status) query = query.eq('status', status)

    const offset = (page - 1) * limit
    query = query
      .order('review_date', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: reviews, error, count } = await query

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération avis')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: reviews,
      meta: {
        page,
        limit,
        total: count ?? 0,
      },
    })
  })

  // POST /api/v1/sites/:siteId/reviews/:reviewId/approve-reply — Approve generated reply
  fastify.post('/api/v1/sites/:siteId/reviews/:reviewId/approve-reply', async (request, reply) => {
    const paramsParse = ReviewParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const bodyParse = ApproveReplyBody.safeParse(request.body ?? {})
    if (!bodyParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: bodyParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, reviewId } = paramsParse.data
    const { editedReply } = bodyParse.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
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

    // Get current review to check it has a generated reply
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id, generated_reply, status')
      .eq('id', reviewId)
      .eq('site_id', siteId)
      .single()

    if (!existingReview) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Avis introuvable' },
      })
    }

    if (!existingReview.generated_reply) {
      return reply.status(422).send({
        error: {
          code: 'NO_GENERATED_REPLY',
          message: "Aucune réponse générée n'est disponible pour cet avis",
        },
      })
    }

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      status: 'replied',
      approved_reply: editedReply ?? existingReview.generated_reply,
      approved_by: request.user.id,
      approved_at: now,
      updated_at: now,
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', reviewId)
      .eq('site_id', siteId)
      .select('*')
      .single()

    if (error || !review) {
      fastify.log.error({ error: error?.message }, 'Erreur approbation réponse avis')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: "Erreur lors de l'approbation de la réponse" },
      })
    }

    return reply.send({ data: review })
  })

  // POST /api/v1/sites/:siteId/reviews/:reviewId/skip — Skip review
  fastify.post('/api/v1/sites/:siteId/reviews/:reviewId/skip', async (request, reply) => {
    const paramsParse = ReviewParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, reviewId } = paramsParse.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
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

    const now = new Date().toISOString()
    const { data: review, error } = await supabase
      .from('reviews')
      .update({
        status: 'skipped',
        updated_at: now,
      })
      .eq('id', reviewId)
      .eq('site_id', siteId)
      .eq('status', 'pending')
      .select('*')
      .single()

    if (error || !review) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Avis introuvable ou déjà traité',
        },
      })
    }

    return reply.send({ data: review })
  })

  // POST /api/v1/sites/:siteId/reviews/sync — Force GMB sync
  fastify.post('/api/v1/sites/:siteId/reviews/sync', async (request, reply) => {
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

    const { siteId } = paramsParse.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, settings')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Verify GMB is configured
    const settings = site.settings as Record<string, unknown> | null
    if (!settings?.gmb_location_id) {
      return reply.status(422).send({
        error: {
          code: 'GMB_NOT_CONFIGURED',
          message: "Le Google My Business n'est pas configuré pour ce site",
        },
      })
    }

    // Stub: create a BullMQ job for GMB sync
    const jobId = randomUUID()

    return reply.status(202).send({
      data: {
        jobId,
        message: 'Synchronisation des avis Google lancée.',
      },
    })
  })
}
