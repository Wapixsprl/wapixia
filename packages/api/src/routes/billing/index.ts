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

const StartSubscriptionBody = z.object({
  moduleIds: z.array(z.string()).min(1, 'Au moins un module requis'),
  redirectUrl: z.string().url('URL de redirection invalide'),
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
// Helper: Mollie API call
// ---------------------------------------------------------------------------

async function mollieRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.mollie.com/v2${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.MOLLIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Mollie API error ${res.status}: ${errorBody}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// TVA constant (Belgium 21%)
// ---------------------------------------------------------------------------

const TVA_RATE = 0.21

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function billingRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/subscription — Current subscription + active modules
  fastify.get('/api/v1/sites/:siteId/subscription', async (request, reply) => {
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
      .select('id, name, plan, plan_price')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Fetch subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) {
      fastify.log.error({ error: subError.message }, 'Erreur récupération abonnement')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    // Fetch active modules
    const { data: modules, error: modError } = await supabase
      .from('site_modules')
      .select('id, module_id, status, config, activated_at, module_catalog(id, name, price_monthly, category)')
      .eq('site_id', siteId)
      .eq('status', 'active')

    if (modError) {
      fastify.log.error({ error: modError.message }, 'Erreur récupération modules actifs')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: {
        subscription: subscription ?? null,
        modules: modules ?? [],
        site: {
          id: site.id,
          name: site.name,
          plan: site.plan,
          planPrice: site.plan_price,
        },
      },
    })
  })

  // POST /api/v1/sites/:siteId/subscription/start — Start subscription
  fastify.post('/api/v1/sites/:siteId/subscription/start', async (request, reply) => {
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

    const bodyParse = StartSubscriptionBody.safeParse(request.body)
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
    const { moduleIds, redirectUrl } = bodyParse.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, name, plan_price, organization_id')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Check no active subscription already exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('site_id', siteId)
      .in('status', ['trialing', 'active'])
      .maybeSingle()

    if (existingSub) {
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Un abonnement actif existe déjà pour ce site',
        },
      })
    }

    // Fetch module prices from catalog
    const { data: catalogModules, error: catalogError } = await supabase
      .from('module_catalog')
      .select('id, name, price_monthly')
      .in('id', moduleIds)

    if (catalogError || !catalogModules || catalogModules.length === 0) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Modules invalides ou introuvables',
        },
      })
    }

    // Calculate pricing breakdown
    const basePriceHT = parseFloat(site.plan_price ?? '0')
    const modulesBreakdown = catalogModules.map((m) => ({
      moduleId: m.id,
      name: m.name,
      priceHT: parseFloat(m.price_monthly),
    }))
    const modulesTotalHT = modulesBreakdown.reduce((sum, m) => sum + m.priceHT, 0)
    const totalHT = basePriceHT + modulesTotalHT
    const tva = Math.round(totalHT * TVA_RATE * 100) / 100
    const totalTTC = Math.round((totalHT + tva) * 100) / 100

    // Create subscription in DB as 'trialing'
    const now = new Date().toISOString()
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days trial
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        site_id: siteId,
        organization_id: site.organization_id,
        status: 'trialing',
        amount_ht: totalHT.toFixed(2),
        amount_tva: tva.toFixed(2),
        amount_ttc: totalTTC.toFixed(2),
        module_ids: moduleIds,
        trial_ends_at: trialEnd,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (subError || !subscription) {
      fastify.log.error({ error: subError?.message }, 'Erreur création abonnement')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: "Erreur lors de la création de l'abonnement" },
      })
    }

    // Create Mollie first payment to get mandate
    let molliePayment
    try {
      molliePayment = await mollieRequest('POST', '/payments', {
        amount: {
          currency: 'EUR',
          value: totalTTC.toFixed(2),
        },
        description: `WapixIA - Abonnement ${site.name}`,
        redirectUrl,
        webhookUrl: `${env.API_PUBLIC_URL}/api/v1/webhooks/mollie`,
        metadata: {
          subscriptionId: subscription.id,
          siteId,
          type: 'first_payment',
        },
        sequenceType: 'first',
      })
    } catch (err) {
      fastify.log.error({ error: (err as Error).message }, 'Erreur Mollie create payment')
      // Rollback subscription to failed
      await supabase
        .from('subscriptions')
        .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
        .eq('id', subscription.id)

      return reply.status(502).send({
        error: {
          code: 'PAYMENT_GATEWAY_ERROR',
          message: 'Erreur lors de la création du paiement. Veuillez réessayer.',
        },
      })
    }

    // Store Mollie payment reference
    await supabase
      .from('payments')
      .insert({
        subscription_id: subscription.id,
        site_id: siteId,
        mollie_payment_id: molliePayment.id,
        amount: totalTTC.toFixed(2),
        currency: 'EUR',
        status: 'pending',
        type: 'first_payment',
        created_at: now,
        updated_at: now,
      })

    // Update subscription with Mollie references
    await supabase
      .from('subscriptions')
      .update({
        mollie_payment_id: molliePayment.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    return reply.status(201).send({
      data: {
        subscriptionId: subscription.id,
        checkoutUrl: molliePayment._links?.checkout?.href ?? null,
        totalAmount: {
          ht: totalHT,
          tva,
          ttc: totalTTC,
        },
        breakdown: {
          basePlan: {
            name: site.plan,
            priceHT: basePriceHT,
          },
          modules: modulesBreakdown,
        },
        trialEndsAt: trialEnd,
      },
    })
  })

  // POST /api/v1/sites/:siteId/subscription/cancel — Cancel subscription
  fastify.post('/api/v1/sites/:siteId/subscription/cancel', async (request, reply) => {
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

    const now = new Date().toISOString()
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        updated_at: now,
      })
      .eq('site_id', siteId)
      .in('status', ['trialing', 'active'])
      .select('*')
      .single()

    if (subError || !subscription) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Aucun abonnement actif trouvé pour ce site' },
      })
    }

    return reply.send({ data: subscription })
  })

  // GET /api/v1/sites/:siteId/billing — Monthly billing recap
  fastify.get('/api/v1/sites/:siteId/billing', async (request, reply) => {
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
      .select('id, name, plan, plan_price')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Fetch active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, status, amount_ht, amount_tva, amount_ttc, module_ids, trial_ends_at, current_period_start, current_period_end')
      .eq('site_id', siteId)
      .in('status', ['trialing', 'active'])
      .maybeSingle()

    // Fetch active modules with prices
    const { data: modules } = await supabase
      .from('site_modules')
      .select('module_id, module_catalog(id, name, price_monthly)')
      .eq('site_id', siteId)
      .eq('status', 'active')

    const basePriceHT = parseFloat(site.plan_price ?? '0')
    const moduleLines = (modules ?? []).map((m) => {
      const catalog = m.module_catalog as { id: string; name: string; price_monthly: string } | null
      return {
        moduleId: catalog?.id ?? m.module_id,
        name: catalog?.name ?? m.module_id,
        priceHT: parseFloat(catalog?.price_monthly ?? '0'),
      }
    })
    const modulesTotalHT = moduleLines.reduce((sum, m) => sum + m.priceHT, 0)
    const totalHT = basePriceHT + modulesTotalHT
    const tva = Math.round(totalHT * TVA_RATE * 100) / 100
    const totalTTC = Math.round((totalHT + tva) * 100) / 100

    return reply.send({
      data: {
        site: {
          id: site.id,
          name: site.name,
          plan: site.plan,
        },
        subscription: subscription ?? null,
        billing: {
          basePlan: {
            name: site.plan,
            priceHT: basePriceHT,
          },
          modules: moduleLines,
          totalHT,
          tvaRate: TVA_RATE,
          tva,
          totalTTC,
        },
      },
    })
  })
}
