import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GoogleCallbackSchema = z.object({
  code: z.string().min(1, 'Code OAuth requis'),
  state: z.string().optional(),
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
// Routes (stubs — full Google OAuth integration in a later sprint)
// ---------------------------------------------------------------------------

export async function googleRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:id/google/auth-url — Generate OAuth URL (stub)
  fastify.get('/api/v1/sites/:id/google/auth-url', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
    const { data: site, error } = await supabase
      .from('sites')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Stub: return a placeholder OAuth URL
    // Real implementation will use Google OAuth2 client
    const oauthUrl = [
      'https://accounts.google.com/o/oauth2/v2/auth',
      '?response_type=code',
      '&client_id=GOOGLE_CLIENT_ID_PLACEHOLDER',
      `&redirect_uri=${encodeURIComponent(`${env.SUPABASE_URL}/api/v1/sites/${id}/google/callback`)}`,
      '&scope=https://www.googleapis.com/auth/business.manage',
      `&state=${id}`,
      '&access_type=offline',
      '&prompt=consent',
    ].join('')

    return reply.send({
      data: {
        authUrl: oauthUrl,
        message: 'Stub: redirigez l\'utilisateur vers cette URL pour démarrer le flux OAuth Google.',
      },
    })
  })

  // POST /api/v1/sites/:id/google/callback — Receive OAuth token (stub)
  fastify.post('/api/v1/sites/:id/google/callback', async (request, reply) => {
    const { id } = request.params as { id: string }

    const parseResult = GoogleCallbackSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: parseResult.error.flatten().fieldErrors,
        },
      })
    }

    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Stub: in production, exchange code for tokens and store them
    // For now, just save the connection status
    const { error: updateError } = await supabase
      .from('sites')
      .update({
        google_connected: true,
        google_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      fastify.log.error({ error: updateError.message }, 'Erreur connexion Google')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: {
        siteId: id,
        connected: true,
        message: 'Stub: connexion Google Business Profile enregistrée.',
      },
    })
  })

  // GET /api/v1/sites/:id/google/status — Check connection status
  fastify.get('/api/v1/sites/:id/google/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: site, error } = await supabase
      .from('sites')
      .select('id, google_connected, google_connected_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    return reply.send({
      data: {
        siteId: id,
        connected: site.google_connected ?? false,
        connectedAt: site.google_connected_at ?? null,
      },
    })
  })
}
