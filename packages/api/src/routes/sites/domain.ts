import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'
import { createDomainManagerService } from '../../services/domain-manager.service.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ConnectDomainSchema = z.object({
  customDomain: z
    .string()
    .min(4, 'Domaine trop court')
    .max(253, 'Domaine trop long')
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
      'Nom de domaine invalide',
    ),
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
// Service singleton
// ---------------------------------------------------------------------------

const domainManager = createDomainManagerService()

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function domainRoutes(fastify: FastifyInstance) {
  // POST /api/v1/sites/:id/connect-domain — Connecter un domaine personnalisé
  fastify.post('/api/v1/sites/:id/connect-domain', async (request, reply) => {
    const { id } = request.params as { id: string }

    const parseResult = ConnectDomainSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Donn\u00e9es invalides',
          details: parseResult.error.flatten().fieldErrors,
        },
      })
    }

    const { customDomain } = parseResult.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // V\u00e9rifier l'acc\u00e8s au site via RLS
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, subdomain, custom_domain')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    try {
      const result = await domainManager.initCustomDomain(id, customDomain, supabase)

      return reply.status(201).send({ data: result })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'

      // Domaine d\u00e9j\u00e0 utilis\u00e9
      if (message.includes('d\u00e9j\u00e0 utilis\u00e9')) {
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: 'Ce domaine est d\u00e9j\u00e0 utilis\u00e9 par un autre site',
          },
        })
      }

      // Domaine invalide ou r\u00e9serv\u00e9
      if (message.includes('invalide') || message.includes('r\u00e9serv\u00e9')) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message,
          },
        })
      }

      fastify.log.error({ error: message }, 'Erreur connexion domaine')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }
  })

  // GET /api/v1/sites/:id/domain-status — V\u00e9rifier la propagation DNS
  fastify.get('/api/v1/sites/:id/domain-status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: site, error } = await supabase
      .from('sites')
      .select('id, subdomain, custom_domain, domain_verified, ssl_status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    const siteRecord = site as {
      id: string
      subdomain: string
      custom_domain: string | null
      domain_verified: boolean | null
      ssl_status: string | null
    }

    if (!siteRecord.custom_domain) {
      return reply.send({
        data: {
          siteId: id,
          customDomain: null,
          status: 'no_domain',
          message: "Aucun domaine personnalis\u00e9 n'est configur\u00e9 pour ce site",
        },
      })
    }

    // V\u00e9rification r\u00e9elle via Cloudflare / Google DNS
    const verifyResult = await domainManager.verifyDNSPropagation(
      id,
      siteRecord.custom_domain,
      supabase,
    )

    let status: string
    if (verifyResult.verified) {
      status = 'verified'
    } else if (verifyResult.cnameFound) {
      status = 'propagating'
    } else {
      status = 'pending_verification'
    }

    return reply.send({
      data: {
        siteId: id,
        customDomain: siteRecord.custom_domain,
        status,
        verified: verifyResult.verified,
        cnameFound: verifyResult.cnameFound,
        sslStatus: siteRecord.ssl_status ?? 'pending',
        dns: {
          type: 'CNAME',
          name: siteRecord.custom_domain,
          target: 'proxy.wapixia.com',
        },
        detail: verifyResult.detail,
      },
    })
  })

  // POST /api/v1/sites/:id/activate-domain — Activer le domaine apr\u00e8s v\u00e9rification DNS
  fastify.post('/api/v1/sites/:id/activate-domain', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, custom_domain, domain_verified')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    const siteRecord = site as {
      id: string
      custom_domain: string | null
      domain_verified: boolean | null
    }

    if (!siteRecord.custom_domain) {
      return reply.status(422).send({
        error: {
          code: 'NO_DOMAIN',
          message: "Aucun domaine personnalis\u00e9 n'est configur\u00e9",
        },
      })
    }

    try {
      const result = await domainManager.activateCustomDomain(
        id,
        siteRecord.custom_domain,
        supabase,
      )

      return reply.send({
        data: {
          siteId: id,
          customDomain: siteRecord.custom_domain,
          activated: result.activated,
          sslReady: result.sslReady,
          detail: result.detail,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'

      if (message.includes('v\u00e9rifi\u00e9')) {
        return reply.status(422).send({
          error: {
            code: 'DNS_NOT_VERIFIED',
            message: 'Le DNS du domaine doit \u00eatre v\u00e9rifi\u00e9 avant activation',
          },
        })
      }

      if (message.includes('Coolify')) {
        return reply.status(422).send({
          error: {
            code: 'NO_APP',
            message: "Le site n'a pas encore d'application d\u00e9ploy\u00e9e",
          },
        })
      }

      fastify.log.error({ error: message }, 'Erreur activation domaine')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }
  })
}
