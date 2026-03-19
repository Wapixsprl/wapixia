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

const DisconnectParams = z.object({
  siteId: z.string().uuid('siteId invalide'),
  platform: z.enum(['facebook', 'instagram', 'linkedin'], {
    errorMap: () => ({ message: 'Plateforme invalide (facebook, instagram, linkedin)' }),
  }),
})

const FacebookCallbackBody = z.object({
  accessToken: z.string().min(1, "Le token d'accès est requis"),
  expiresIn: z.number().int().positive().optional(),
  pageId: z.string().min(1, "L'ID de la page Facebook est requis"),
  pageName: z.string().min(1, 'Le nom de la page Facebook est requis'),
  pageAccessToken: z.string().min(1, "Le token d'accès de la page est requis"),
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

export async function socialRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/social-accounts — List connected social accounts
  fastify.get('/api/v1/sites/:siteId/social-accounts', async (request, reply) => {
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

    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select(`
        id,
        platform,
        account_name,
        account_id,
        status,
        connected_at,
        expires_at,
        created_at
      `)
      .eq('site_id', siteId)
      .eq('status', 'active')
      .order('platform', { ascending: true })

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération comptes sociaux')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: accounts,
      meta: { total: accounts?.length ?? 0 },
    })
  })

  // POST /api/v1/sites/:siteId/social-accounts/facebook/connect — Init Facebook OAuth (stub)
  fastify.post('/api/v1/sites/:siteId/social-accounts/facebook/connect', async (request, reply) => {
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
      .select('id')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Stub: return OAuth redirect URL (actual Facebook OAuth in a future sprint)
    const redirectUri = `${env.API_URL ?? 'http://localhost:3001'}/api/v1/sites/${siteId}/social-accounts/facebook/callback`
    const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=FACEBOOK_APP_ID&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_manage_posts,pages_read_engagement`

    return reply.send({
      data: {
        oauthUrl,
        message: "Redirigez l'utilisateur vers cette URL pour connecter Facebook.",
      },
    })
  })

  // POST /api/v1/sites/:siteId/social-accounts/facebook/callback — Receive Facebook token
  fastify.post('/api/v1/sites/:siteId/social-accounts/facebook/callback', async (request, reply) => {
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

    const bodyParse = FacebookCallbackBody.safeParse(request.body)
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
    const { pageId, pageName, pageAccessToken, expiresIn } = bodyParse.data
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

    // Check for existing active Facebook account
    const { data: existing } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('site_id', siteId)
      .eq('platform', 'facebook')
      .eq('status', 'active')
      .maybeSingle()

    const now = new Date().toISOString()
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null

    const accountData = {
      site_id: siteId,
      platform: 'facebook' as const,
      account_id: pageId,
      account_name: pageName,
      access_token: pageAccessToken,
      status: 'active',
      connected_at: now,
      connected_by: request.user.id,
      expires_at: expiresAt,
      updated_at: now,
    }

    let result
    if (existing) {
      // Update existing account
      const { data, error } = await supabase
        .from('social_accounts')
        .update(accountData)
        .eq('id', existing.id)
        .select('id, platform, account_name, account_id, status, connected_at, expires_at')
        .single()
      result = { data, error }
    } else {
      // Insert new account
      const { data, error } = await supabase
        .from('social_accounts')
        .insert(accountData)
        .select('id, platform, account_name, account_id, status, connected_at, expires_at')
        .single()
      result = { data, error }
    }

    if (result.error || !result.data) {
      fastify.log.error({ error: result.error?.message }, 'Erreur connexion compte Facebook')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la connexion du compte Facebook' },
      })
    }

    return reply.status(201).send({ data: result.data })
  })

  // DELETE /api/v1/sites/:siteId/social-accounts/:platform — Disconnect social account
  fastify.delete('/api/v1/sites/:siteId/social-accounts/:platform', async (request, reply) => {
    const paramsParse = DisconnectParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, platform } = paramsParse.data
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
    const { data: account, error } = await supabase
      .from('social_accounts')
      .update({
        status: 'disconnected',
        access_token: null,
        disconnected_at: now,
        updated_at: now,
      })
      .eq('site_id', siteId)
      .eq('platform', platform)
      .eq('status', 'active')
      .select('id, platform, account_name, status')
      .single()

    if (error || !account) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Aucun compte ${platform} actif trouvé pour ce site`,
        },
      })
    }

    return reply.send({ data: account })
  })
}
