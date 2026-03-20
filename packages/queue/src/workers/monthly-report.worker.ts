// @wapixia/queue — Monthly report generation worker

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { MonthlyReportJobData, MonthlyReportResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'
import { createAnalyticsService } from './helpers/analytics-bridge.js'
import { calculateVisibilityScore } from './helpers/score-bridge.js'
import { generateMonthlyReport } from './helpers/report-bridge.js'

const WORKER_NAME = 'monthly-report'

/**
 * Process a monthly report generation job.
 *
 * Steps:
 *   1. Import analytics data (GA4 + GSC)        →  5% → 30%
 *   2. Compute lead stats                       → 30% → 55%
 *   3. Calculate visibility score                → 55% → 55%
 *   4. Detect competitors                        → 55% → 85%
 *   5. Generate PDF + upload + save              → 85% → 95%
 *   6. Send email via Brevo                      → 95% → 100%
 */
async function processMonthlyReport(
  job: Job<MonthlyReportJobData>,
): Promise<MonthlyReportResult> {
  const { siteId, recipientEmail } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, siteId }

  workerLogger.info('Starting monthly report generation', ctx)

  const supabase = createSupabaseClient()

  // ── Step 1: Import analytics (5% → 30%) ──
  await job.updateProgress(5)
  workerLogger.info('Step 1/6: Importing analytics data', ctx)

  const analytics = createAnalyticsService()

  const [ga4Result, gscResult] = await Promise.all([
    analytics.importGA4Data(siteId),
    analytics.importSearchConsoleData(siteId),
  ])

  workerLogger.info('Analytics imported', {
    ...ctx,
    ga4Sessions: ga4Result.totalSessions,
    gscClicks: gscResult.totalClicks,
  })

  await job.updateProgress(30)

  // ── Step 2: Compute lead stats (30% → 55%) ──
  workerLogger.info('Step 2/6: Computing lead stats', ctx)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const { count: totalLeads } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .gte('created_at', thirtyDaysAgo)

  workerLogger.info('Lead stats computed', { ...ctx, totalLeads: totalLeads ?? 0 })

  await job.updateProgress(55)

  // ── Step 3: Calculate visibility score (55%) ──
  workerLogger.info('Step 3/6: Calculating visibility score', ctx)

  const scoreResult = await calculateVisibilityScore(siteId)

  workerLogger.info('Visibility score calculated', {
    ...ctx,
    score: scoreResult.score,
  })

  // ── Step 4: Detect competitors (55% → 85%) ──
  workerLogger.info('Step 4/6: Detecting competitors', ctx)

  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, visibility_score')
    .eq('site_id', siteId)
    .order('visibility_score', { ascending: false })
    .limit(5)

  workerLogger.info('Competitors detected', {
    ...ctx,
    competitorCount: competitors?.length ?? 0,
  })

  await job.updateProgress(85)

  // ── Step 5: Generate PDF (85% → 95%) ──
  workerLogger.info('Step 5/6: Generating PDF report', ctx)

  const reportResult = await generateMonthlyReport(siteId)

  workerLogger.info('PDF generated and uploaded', {
    ...ctx,
    pdfUrl: reportResult.pdfUrl,
    pdfSizeBytes: reportResult.pdfSizeBytes,
    reportId: reportResult.reportId,
  })

  await job.updateProgress(95)

  // ── Step 6: Send email via Brevo (95% → 100%) ──
  workerLogger.info('Step 6/6: Sending report email', ctx)

  if (recipientEmail) {
    // Fetch site name for email
    const { data: site } = await supabase
      .from('sites')
      .select('name')
      .eq('id', siteId)
      .single()

    const siteName = (site?.name as string) ?? 'Votre site'

    // Send email via Brevo (stub in Sprint 4)
    // In production, this would use the Brevo service with template MONTHLY_REPORT
    console.log(
      `[${WORKER_NAME}] STUB: sendEmail(to="${recipientEmail}", template=MONTHLY_REPORT, params={ site_name: "${siteName}", pdf_url: "${reportResult.pdfUrl}", score: ${scoreResult.score} })`,
    )
  } else {
    workerLogger.info('No recipient email — skipping email send', ctx)
  }

  await job.updateProgress(100)

  workerLogger.info('Monthly report generation completed', {
    ...ctx,
    reportId: reportResult.reportId,
    score: scoreResult.score,
  })

  return {
    reportId: reportResult.reportId,
    pdfUrl: reportResult.pdfUrl,
    pdfSizeBytes: reportResult.pdfSizeBytes,
    visibilityScore: scoreResult.score,
  }
}

// ── Worker instance ──

export const monthlyReportWorker = new Worker<MonthlyReportJobData, MonthlyReportResult>(
  QUEUE_NAMES.MONTHLY_REPORT,
  processMonthlyReport,
  {
    connection,
    concurrency: 1,
    limiter: { max: 3, duration: 60_000 },
  },
)

monthlyReportWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    siteId: job.data.siteId,
  })
})

monthlyReportWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    siteId: job?.data.siteId,
    error,
  })
})
