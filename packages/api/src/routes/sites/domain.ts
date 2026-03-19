import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'

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
// Routes
// ---------------------------------------------------------------------------

export async function domainRoutes(fastify: FastifyInstance) {
  // POST /api/v1/sites/:id/connect-domain — Connect custom domain (stub)
  fastify.post('/api/v1/sites/:id/connect-domain', async (request, reply) => {
    const { id } = request.params as { id: string }

    const parseResult = ConnectDomainSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: parseResult.error.flatten().fieldErrors,
        },
      })
    }

    const { customDomain } = parseResult.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
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

    // Check domain not already in use by another site
    const { data: existingDomain } = await supabase
      .from('sites')
      .select('id')
      .eq('custom_domain', customDomain)
      .neq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingDomain) {
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Ce domaine est déjà utilisé par un autre site',
        },
      })
    }

    // Save domain to site (pending verification)
    const { error: updateError } = await supabase
      .from('sites')
      .update({
        custom_domain: customDomain,
        domain_status: 'pending_verification',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      fastify.log.error({ error: updateError.message }, 'Erreur connexion domaine')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    // Return CNAME instructions (stub — actual Cloudflare API call will come later)
    const cnameTarget = `${site.subdomain}.wapixia.com`

    return reply.status(201).send({
      data: {
        customDomain,
        status: 'pending_verification',
        dns: {
          type: 'CNAME',
          name: customDomain,
          target: cnameTarget,
          instructions: `Ajoutez un enregistrement CNAME pointant "${customDomain}" vers "${cnameTarget}" chez votre registrar DNS. La propagation peut prendre jusqu'à 48 heures.`,
        },
      },
    })
  })

  // GET /api/v1/sites/:id/domain-status — Check DNS propagation status
  fastify.get('/api/v1/sites/:id/domain-status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: site, error } = await supabase
      .from('sites')
      .select('id, subdomain, custom_domain, domain_status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    if (!site.custom_domain) {
      return reply.send({
        data: {
          siteId: id,
          customDomain: null,
          status: 'no_domain',
          message: "Aucun domaine personnalisé n'est configuré pour ce site",
        },
      })
    }

    // Stub: return current stored status
    // Actual DNS check via Cloudflare API will be implemented later
    return reply.send({
      data: {
        siteId: id,
        customDomain: site.custom_domain,
        status: site.domain_status ?? 'pending_verification',
        dns: {
          type: 'CNAME',
          name: site.custom_domain,
          target: `${site.subdomain}.wapixia.com`,
        },
      },
    })
  })
}
