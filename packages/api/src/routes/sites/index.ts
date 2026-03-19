import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'
import { requireRole } from '../../plugins/auth.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateSiteSchema = z.object({
  name: z.string().min(1, 'Nom du site requis').max(100),
  organizationId: z.string().uuid('Organization ID invalide'),
  subdomain: z
    .string()
    .min(3, 'Sous-domaine trop court')
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Sous-domaine invalide (minuscules, chiffres, tirets)'),
  plan: z.enum(['starter', 'pro', 'enterprise']).default('starter'),
})

const UpdateSiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subdomain: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Sous-domaine invalide')
    .optional(),
  plan: z.enum(['starter', 'pro', 'enterprise']).optional(),
  customDomain: z.string().max(253).optional().nullable(),
  settings: z.record(z.unknown()).optional(),
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

export async function sitesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites — List sites (RLS scoped)
  fastify.get('/api/v1/sites', async (request, reply) => {
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: sites, error } = await supabase
      .from('sites')
      .select(`
        id,
        name,
        subdomain,
        custom_domain,
        plan,
        status,
        onboarding_completed,
        organization_id,
        created_at,
        updated_at
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération sites')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: sites,
      meta: { total: sites?.length ?? 0 },
    })
  })

  // GET /api/v1/sites/:id — Get site detail
  fastify.get('/api/v1/sites/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    return reply.send({ data: site })
  })

  // POST /api/v1/sites — Create a new site (requires admin role)
  fastify.post(
    '/api/v1/sites',
    {
      preHandler: requireRole([
        'superadmin',
        'reseller_admin',
        'client_admin',
      ]),
    },
    async (request, reply) => {
      const parseResult = CreateSiteSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données invalides',
            details: parseResult.error.flatten().fieldErrors,
          },
        })
      }

      const { name, organizationId, subdomain, plan } = parseResult.data
      const supabase = rlsClient(request.headers.authorization ?? '')

      // Check subdomain uniqueness
      const { data: existing } = await supabase
        .from('sites')
        .select('id')
        .eq('subdomain', subdomain)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing) {
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: 'Ce sous-domaine est déjà utilisé',
          },
        })
      }

      const { data: site, error } = await supabase
        .from('sites')
        .insert({
          name,
          organization_id: organizationId,
          subdomain,
          plan,
          status: 'onboarding',
          onboarding_completed: false,
        })
        .select('*')
        .single()

      if (error) {
        fastify.log.error({ error: error.message }, 'Erreur création site')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la création du site' },
        })
      }

      return reply.status(201).send({ data: site })
    },
  )

  // PATCH /api/v1/sites/:id — Update site settings
  fastify.patch('/api/v1/sites/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const parseResult = UpdateSiteSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: parseResult.error.flatten().fieldErrors,
        },
      })
    }

    const updates = parseResult.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Build the DB update payload (camelCase -> snake_case)
    const dbUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.subdomain !== undefined) dbUpdates.subdomain = updates.subdomain
    if (updates.plan !== undefined) dbUpdates.plan = updates.plan
    if (updates.customDomain !== undefined) dbUpdates.custom_domain = updates.customDomain
    if (updates.settings !== undefined) dbUpdates.settings = updates.settings
    dbUpdates.updated_at = new Date().toISOString()

    const { data: site, error } = await supabase
      .from('sites')
      .update(dbUpdates)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single()

    if (error || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable ou mise à jour impossible' },
      })
    }

    return reply.send({ data: site })
  })
}
