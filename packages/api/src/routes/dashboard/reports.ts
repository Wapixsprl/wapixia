import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'

// ---------------------------------------------------------------------------
// Helper: create RLS-scoped Supabase client
// ---------------------------------------------------------------------------

function rlsClient(authorization: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  })
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SiteIdParamsSchema = z.object({
  siteId: z.string().uuid('siteId invalide'),
})

const ReportParamsSchema = z.object({
  siteId: z.string().uuid('siteId invalide'),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function reportsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sites/:siteId/reports — List all reports
  fastify.get('/api/v1/sites/:siteId/reports', async (request, reply) => {
    const paramsResult = SiteIdParamsSchema.safeParse(request.params)
    if (!paramsResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsResult.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsResult.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: reports, error } = await supabase
      .from('reports')
      .select('id, year, month, status, pdf_url, generated_at, created_at')
      .eq('site_id', siteId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération rapports')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: (reports ?? []).map((r) => ({
        id: r.id,
        year: r.year,
        month: r.month,
        status: r.status,
        pdfUrl: r.pdf_url,
        generatedAt: r.generated_at,
        createdAt: r.created_at,
      })),
      meta: { total: reports?.length ?? 0 },
    })
  })

  // GET /api/v1/sites/:siteId/reports/:year/:month — Specific report
  fastify.get('/api/v1/sites/:siteId/reports/:year/:month', async (request, reply) => {
    const paramsResult = ReportParamsSchema.safeParse(request.params)
    if (!paramsResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsResult.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId, year, month } = paramsResult.data
    const supabase = rlsClient(request.headers.authorization ?? '')

    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('site_id', siteId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération rapport')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    if (!report) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Rapport introuvable pour ${month}/${year}`,
        },
      })
    }

    return reply.send({
      data: {
        id: report.id,
        year: report.year,
        month: report.month,
        status: report.status,
        pdfUrl: report.pdf_url,
        summary: report.summary,
        generatedAt: report.generated_at,
        createdAt: report.created_at,
      },
    })
  })

  // POST /api/v1/sites/:siteId/reports/generate — Force manual generation
  fastify.post('/api/v1/sites/:siteId/reports/generate', async (request, reply) => {
    const paramsResult = SiteIdParamsSchema.safeParse(request.params)
    if (!paramsResult.success) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: paramsResult.error.flatten().fieldErrors,
        },
      })
    }

    const { siteId } = paramsResult.data
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

    // Create a report generation job
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const { data: job, error: jobError } = await supabase
      .from('report_jobs')
      .insert({
        site_id: siteId,
        year,
        month,
        status: 'pending',
        requested_by: request.user.id,
      })
      .select('id, status, created_at')
      .single()

    if (jobError) {
      fastify.log.error({ error: jobError.message }, 'Erreur création job de rapport')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la création du job de rapport' },
      })
    }

    return reply.status(202).send({
      data: {
        jobId: job.id,
        status: job.status,
        message: 'Génération du rapport lancée',
        createdAt: job.created_at,
      },
    })
  })
}
