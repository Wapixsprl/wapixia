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

const ModuleParams = z.object({
  siteId: z.string().uuid('siteId invalide'),
  moduleId: z.string().uuid('moduleId invalide'),
})

const ActivateModuleBody = z.object({
  config: z.record(z.unknown()).optional(),
})

const UpdateModuleConfigBody = z.object({
  config: z.record(z.unknown()),
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
// Prereq validation map
// ---------------------------------------------------------------------------

const PREREQ_CHECKS: Record<string, (supabase: ReturnType<typeof createClient>, siteId: string) => Promise<string | null>> = {
  gmb_reviews: async (supabase, siteId) => {
    const { data: site } = await supabase
      .from('sites')
      .select('settings')
      .eq('id', siteId)
      .single()

    const settings = site?.settings as Record<string, unknown> | null
    if (!settings?.gmb_location_id) {
      return 'Le module GMB Reviews nécessite un gmb_location_id configuré dans les paramètres du site'
    }
    return null
  },
  social_posts: async (supabase, siteId) => {
    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('site_id', siteId)
      .limit(1)

    if (!accounts || accounts.length === 0) {
      return 'Le module Social Posts nécessite au moins un compte social connecté'
    }
    return null
  },
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function modulesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/modules — List all modules with activation status
  fastify.get('/api/v1/sites/:siteId/modules', async (request, reply) => {
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

    // Fetch all catalog modules
    const { data: catalog, error: catalogError } = await supabase
      .from('module_catalog')
      .select('*')
      .order('name', { ascending: true })

    if (catalogError) {
      fastify.log.error({ error: catalogError.message }, 'Erreur récupération catalogue modules')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    // Fetch active site modules
    const { data: siteModules, error: siteModulesError } = await supabase
      .from('site_modules')
      .select('*')
      .eq('site_id', siteId)

    if (siteModulesError) {
      fastify.log.error({ error: siteModulesError.message }, 'Erreur récupération modules du site')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    // Join catalog with site_modules
    const siteModuleMap = new Map(
      (siteModules ?? []).map((sm) => [sm.module_id, sm]),
    )

    const modules = (catalog ?? []).map((mod) => {
      const siteModule = siteModuleMap.get(mod.id)
      return {
        id: mod.id,
        slug: mod.slug,
        name: mod.name,
        description: mod.description,
        category: mod.category,
        prereqs: mod.prereqs,
        isActive: siteModule ? siteModule.status === 'active' : false,
        status: siteModule?.status ?? null,
        config: siteModule?.config ?? null,
        activatedAt: siteModule?.activated_at ?? null,
      }
    })

    return reply.send({
      data: modules,
      meta: {
        total: modules.length,
        active: modules.filter((m) => m.isActive).length,
      },
    })
  })

  // POST /api/v1/sites/:siteId/modules/:moduleId — Activate module
  fastify.post('/api/v1/sites/:siteId/modules/:moduleId', async (request, reply) => {
    const paramsParse = ModuleParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const bodyParse = ActivateModuleBody.safeParse(request.body ?? {})
    if (!bodyParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: bodyParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, moduleId } = paramsParse.data
    const { config } = bodyParse.data
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

    // Verify module exists in catalog
    const { data: catalogModule, error: catalogError } = await supabase
      .from('module_catalog')
      .select('*')
      .eq('id', moduleId)
      .single()

    if (catalogError || !catalogModule) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Module introuvable dans le catalogue' },
      })
    }

    // Check prerequisites
    const prereqCheck = PREREQ_CHECKS[catalogModule.slug as string]
    if (prereqCheck) {
      const prereqError = await prereqCheck(supabase, siteId)
      if (prereqError) {
        return reply.status(422).send({
          error: {
            code: 'PREREQ_NOT_MET',
            message: prereqError,
          },
        })
      }
    }

    // Check if already active
    const { data: existing } = await supabase
      .from('site_modules')
      .select('id, status')
      .eq('site_id', siteId)
      .eq('module_id', moduleId)
      .maybeSingle()

    if (existing && existing.status === 'active') {
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Ce module est déjà activé pour ce site',
        },
      })
    }

    // Activate: upsert into site_modules
    const now = new Date().toISOString()
    const moduleData = {
      site_id: siteId,
      module_id: moduleId,
      status: 'active',
      config: config ?? {},
      activated_at: now,
      cancelled_at: null,
      updated_at: now,
    }

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('site_modules')
        .update(moduleData)
        .eq('id', existing.id)
        .select('*')
        .single()
      result = { data, error }
    } else {
      const { data, error } = await supabase
        .from('site_modules')
        .insert(moduleData)
        .select('*')
        .single()
      result = { data, error }
    }

    if (result.error || !result.data) {
      fastify.log.error({ error: result.error?.message }, 'Erreur activation module')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: "Erreur lors de l'activation du module" },
      })
    }

    return reply.status(201).send({ data: result.data })
  })

  // DELETE /api/v1/sites/:siteId/modules/:moduleId — Deactivate module
  fastify.delete('/api/v1/sites/:siteId/modules/:moduleId', async (request, reply) => {
    const paramsParse = ModuleParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, moduleId } = paramsParse.data
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
    const { data: siteModule, error } = await supabase
      .from('site_modules')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        updated_at: now,
      })
      .eq('site_id', siteId)
      .eq('module_id', moduleId)
      .eq('status', 'active')
      .select('*')
      .single()

    if (error || !siteModule) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Module actif introuvable pour ce site' },
      })
    }

    return reply.send({ data: siteModule })
  })

  // PATCH /api/v1/sites/:siteId/modules/:moduleId — Update module config
  fastify.patch('/api/v1/sites/:siteId/modules/:moduleId', async (request, reply) => {
    const paramsParse = ModuleParams.safeParse(request.params)
    if (!paramsParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsParse.error.flatten().fieldErrors,
        },
      })
    }

    const bodyParse = UpdateModuleConfigBody.safeParse(request.body)
    if (!bodyParse.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: bodyParse.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, moduleId } = paramsParse.data
    const { config } = bodyParse.data
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
    const { data: siteModule, error } = await supabase
      .from('site_modules')
      .update({
        config,
        updated_at: now,
      })
      .eq('site_id', siteId)
      .eq('module_id', moduleId)
      .eq('status', 'active')
      .select('*')
      .single()

    if (error || !siteModule) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Module actif introuvable pour ce site' },
      })
    }

    return reply.send({ data: siteModule })
  })
}
