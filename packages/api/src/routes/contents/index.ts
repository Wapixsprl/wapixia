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

const ContentParams = z.object({
  siteId: z.string().uuid('siteId invalide'),
  contentId: z.string().uuid('contentId invalide'),
})

const ListContentsQuery = z.object({
  status: z
    .enum(['draft', 'pending_validation', 'approved', 'rejected', 'published', 'scheduled'])
    .optional(),
  type: z
    .enum(['blog_article', 'social_post', 'gmb_post', 'page_content', 'meta_description'])
    .optional(),
  platform: z
    .enum(['facebook', 'instagram', 'linkedin', 'google', 'website'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const RejectContentBody = z.object({
  rejectionNote: z.string().min(1, 'La note de rejet est requise').max(1000),
})

const GenerateContentBody = z.object({
  type: z.enum(['blog_article', 'social_post', 'gmb_post', 'page_content', 'meta_description']),
  platform: z
    .enum(['facebook', 'instagram', 'linkedin', 'google', 'website'])
    .optional(),
  topic: z.string().min(1, 'Le sujet est requis').max(500).optional(),
  instructions: z.string().max(2000).optional(),
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

export async function contentsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/contents — List contents with filters + pagination
  fastify.get('/api/v1/sites/:siteId/contents', async (request, reply) => {
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

    const queryParse = ListContentsQuery.safeParse(request.query)
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
    const { status, type, platform, page, limit } = queryParse.data
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
      .from('contents')
      .select('*', { count: 'exact' })
      .eq('site_id', siteId)
      .is('deleted_at', null)

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('type', type)
    if (platform) query = query.eq('platform', platform)

    const offset = (page - 1) * limit
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: contents, error, count } = await query

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération contenus')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    // Counts for pending and published
    const { count: pendingCount } = await supabase
      .from('contents')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'pending_validation')
      .is('deleted_at', null)

    const { count: publishedCount } = await supabase
      .from('contents')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'published')
      .is('deleted_at', null)

    return reply.send({
      data: contents,
      meta: {
        page,
        limit,
        total: count ?? 0,
        pending: pendingCount ?? 0,
        published: publishedCount ?? 0,
      },
    })
  })

  // GET /api/v1/sites/:siteId/contents/:contentId — Content detail
  fastify.get('/api/v1/sites/:siteId/contents/:contentId', async (request, reply) => {
    const paramsParse = ContentParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, contentId } = paramsParse.data
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

    const { data: content, error } = await supabase
      .from('contents')
      .select('*')
      .eq('id', contentId)
      .eq('site_id', siteId)
      .is('deleted_at', null)
      .single()

    if (error || !content) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Contenu introuvable' },
      })
    }

    return reply.send({ data: content })
  })

  // POST /api/v1/sites/:siteId/contents/:contentId/approve — Approve content
  fastify.post('/api/v1/sites/:siteId/contents/:contentId/approve', async (request, reply) => {
    const paramsParse = ContentParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, contentId } = paramsParse.data
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
    const { data: content, error } = await supabase
      .from('contents')
      .update({
        status: 'approved',
        validated_by: request.user.id,
        validated_at: now,
        updated_at: now,
      })
      .eq('id', contentId)
      .eq('site_id', siteId)
      .eq('status', 'pending_validation')
      .is('deleted_at', null)
      .select('*')
      .single()

    if (error || !content) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Contenu introuvable ou non en attente de validation',
        },
      })
    }

    return reply.send({ data: content })
  })

  // POST /api/v1/sites/:siteId/contents/:contentId/reject — Reject content
  fastify.post('/api/v1/sites/:siteId/contents/:contentId/reject', async (request, reply) => {
    const paramsParse = ContentParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const bodyParse = RejectContentBody.safeParse(request.body)
    if (!bodyParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: bodyParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, contentId } = paramsParse.data
    const { rejectionNote } = bodyParse.data
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
    const { data: content, error } = await supabase
      .from('contents')
      .update({
        status: 'rejected',
        rejection_note: rejectionNote,
        validated_by: request.user.id,
        validated_at: now,
        updated_at: now,
      })
      .eq('id', contentId)
      .eq('site_id', siteId)
      .eq('status', 'pending_validation')
      .is('deleted_at', null)
      .select('*')
      .single()

    if (error || !content) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Contenu introuvable ou non en attente de validation',
        },
      })
    }

    return reply.send({ data: content })
  })

  // POST /api/v1/sites/:siteId/contents/generate — Trigger manual generation
  fastify.post('/api/v1/sites/:siteId/contents/generate', async (request, reply) => {
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

    const bodyParse = GenerateContentBody.safeParse(request.body)
    if (!bodyParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: bodyParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsParse.data
    const { type, platform, topic, instructions } = bodyParse.data
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

    // Stub: create a BullMQ job ID (actual queue integration in a future sprint)
    const jobId = randomUUID()

    return reply.status(202).send({
      data: {
        jobId,
        type,
        platform: platform ?? null,
        topic: topic ?? null,
        instructions: instructions ?? null,
        message: 'Génération de contenu lancée. Le contenu apparaîtra dans la liste une fois prêt.',
      },
    })
  })
}
