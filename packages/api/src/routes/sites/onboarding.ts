import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { env } from '../../env.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const OnboardingStepSchema = z.object({
  step: z.number().int().min(1).max(10),
  answers: z.record(z.unknown()),
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

export async function onboardingRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:id/onboarding — Get current onboarding session
  fastify.get('/api/v1/sites/:id/onboarding', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access via RLS
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, name, onboarding_completed')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    // Fetch the latest onboarding session
    const { data: session, error } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération onboarding')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    // If no session exists yet, return a blank state
    if (!session) {
      return reply.send({
        data: {
          siteId: id,
          currentStep: 1,
          totalSteps: 6,
          steps: {},
          completed: false,
        },
      })
    }

    return reply.send({
      data: {
        id: session.id,
        siteId: session.site_id,
        currentStep: session.current_step,
        totalSteps: session.total_steps,
        steps: session.steps,
        completed: session.completed,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
    })
  })

  // PUT /api/v1/sites/:id/onboarding/step — Save a step
  fastify.put('/api/v1/sites/:id/onboarding/step', async (request, reply) => {
    const { id } = request.params as { id: string }

    const parseResult = OnboardingStepSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: parseResult.error.flatten().fieldErrors,
        },
      })
    }

    const { step, answers } = parseResult.data
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

    // Upsert onboarding session
    const { data: existing } = await supabase
      .from('onboarding_sessions')
      .select('id, steps')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentSteps = (existing?.steps as Record<string, unknown>) ?? {}
    const mergedSteps = { ...currentSteps, [String(step)]: answers }

    if (existing) {
      // Update existing session
      const { data: session, error } = await supabase
        .from('onboarding_sessions')
        .update({
          steps: mergedSteps,
          current_step: step + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (error || !session) {
        fastify.log.error({ error: error?.message }, 'Erreur mise à jour onboarding')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
        })
      }

      return reply.send({
        data: {
          id: session.id,
          siteId: session.site_id,
          currentStep: session.current_step,
          steps: session.steps,
          completed: session.completed,
        },
      })
    }

    // Create new session
    const { data: session, error } = await supabase
      .from('onboarding_sessions')
      .insert({
        site_id: id,
        steps: mergedSteps,
        current_step: step + 1,
        total_steps: 6,
        completed: false,
      })
      .select('*')
      .single()

    if (error || !session) {
      fastify.log.error({ error: error?.message }, 'Erreur création onboarding')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.status(201).send({
      data: {
        id: session.id,
        siteId: session.site_id,
        currentStep: session.current_step,
        steps: session.steps,
        completed: session.completed,
      },
    })
  })

  // POST /api/v1/sites/:id/onboarding/complete — Trigger AI generation
  fastify.post('/api/v1/sites/:id/onboarding/complete', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, onboarding_completed')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    if (site.onboarding_completed) {
      return reply.status(409).send({
        error: {
          code: 'ALREADY_COMPLETED',
          message: "L'onboarding a déjà été complété pour ce site",
        },
      })
    }

    // Verify that a session with steps exists
    const { data: session } = await supabase
      .from('onboarding_sessions')
      .select('id, steps')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session || !session.steps || Object.keys(session.steps as Record<string, unknown>).length === 0) {
      return reply.status(422).send({
        error: {
          code: 'INCOMPLETE_ONBOARDING',
          message: "Aucune étape d'onboarding n'a été complétée",
        },
      })
    }

    // Generate a jobId — the actual BullMQ job will be Sprint 2 Phase 8
    const jobId = randomUUID()

    // Mark session as completed
    await supabase
      .from('onboarding_sessions')
      .update({
        completed: true,
        job_id: jobId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    // Update site status
    await supabase
      .from('sites')
      .update({
        status: 'generating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    // Return 202 Accepted — actual generation is async
    return reply.status(202).send({
      data: {
        jobId,
        estimatedMinutes: 5,
        message: 'Génération du site lancée. Utilisez /onboarding/status pour suivre la progression.',
      },
    })
  })

  // GET /api/v1/sites/:id/onboarding/status — Poll generation status
  fastify.get('/api/v1/sites/:id/onboarding/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = rlsClient(request.headers.authorization ?? '')

    // Verify site access
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, status, onboarding_completed')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (siteError || !site) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Site introuvable' },
      })
    }

    const { data: session } = await supabase
      .from('onboarding_sessions')
      .select('id, job_id, completed, updated_at')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Determine generation status from site.status
    let generationStatus: string
    switch (site.status) {
      case 'generating':
        generationStatus = 'in_progress'
        break
      case 'active':
        generationStatus = 'completed'
        break
      case 'error':
        generationStatus = 'failed'
        break
      default:
        generationStatus = 'pending'
    }

    return reply.send({
      data: {
        siteId: id,
        jobId: session?.job_id ?? null,
        status: generationStatus,
        onboardingCompleted: site.onboarding_completed,
        updatedAt: session?.updated_at ?? null,
      },
    })
  })
}
