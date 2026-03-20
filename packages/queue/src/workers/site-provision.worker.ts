// @wapixia/queue — Site provisioning worker
// Processes site:provision jobs by calling the site provisioner HTTP API
// and reporting progress at each step.

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { SiteProvisionJobData } from '../types.js'
import { workerLogger } from '../logger.js'

const WORKER_NAME = 'site-provision'

/** Result returned on successful provisioning */
interface SiteProvisionResult {
  siteId: string
  provisionedAt: string
  status: 'provisioned' | 'failed'
}

/**
 * Call the site provisioner service HTTP API.
 */
async function callProvisionerApi(
  siteId: string,
  action: string,
): Promise<{ success: boolean; message: string }> {
  const baseUrl = process.env.PROVISIONER_API_URL

  if (!baseUrl || baseUrl === 'stub') {
    workerLogger.info(`STUB: Provisioner API call — ${action}`, {
      worker: WORKER_NAME,
      jobId: 'n/a',
      siteId,
    })
    return { success: true, message: `stub:${action}` }
  }

  const response = await fetch(`${baseUrl}/provision/${siteId}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PROVISIONER_API_SECRET ?? ''}`,
    },
    body: JSON.stringify({ siteId }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Provisioner API error (${response.status}): ${errorText}`)
  }

  return (await response.json()) as { success: boolean; message: string }
}

/**
 * Send an alert to superadmin on provisioning failure.
 */
async function alertSuperadmin(siteId: string, errorMessage: string): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL

  if (!webhookUrl) {
    workerLogger.warn('ALERT_WEBHOOK_URL not set, cannot alert superadmin', {
      worker: WORKER_NAME,
      jobId: 'n/a',
      siteId,
    })
    return
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'failure',
        service: 'site-provision',
        siteId,
        message: `Site provisioning failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (err) {
    workerLogger.error('Failed to send superadmin alert', {
      worker: WORKER_NAME,
      jobId: 'n/a',
      siteId,
      error: err,
    })
  }
}

/**
 * Provisioning pipeline with granular progress updates.
 */
async function processSiteProvision(
  job: Job<SiteProvisionJobData>,
): Promise<SiteProvisionResult> {
  const { siteId } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, siteId }

  workerLogger.info('Starting site provisioning', ctx)

  try {
    // Step 1: Initialize provisioning
    await job.updateProgress(5)
    workerLogger.info('Initializing provisioning', ctx)
    await callProvisionerApi(siteId, 'init')

    // Step 2: Create server resources
    await job.updateProgress(20)
    workerLogger.info('Creating server resources', ctx)
    await callProvisionerApi(siteId, 'create-resources')

    // Step 3: Configure networking
    await job.updateProgress(40)
    workerLogger.info('Configuring networking', ctx)
    await callProvisionerApi(siteId, 'configure-network')

    // Step 4: Deploy application
    await job.updateProgress(55)
    workerLogger.info('Deploying application', ctx)
    await callProvisionerApi(siteId, 'deploy')

    // Step 5: Configure SSL/TLS
    await job.updateProgress(70)
    workerLogger.info('Configuring SSL/TLS', ctx)
    await callProvisionerApi(siteId, 'configure-ssl')

    // Step 6: Run health checks
    await job.updateProgress(80)
    workerLogger.info('Running health checks', ctx)
    await callProvisionerApi(siteId, 'health-check')

    // Step 7: Finalize and activate
    await job.updateProgress(90)
    workerLogger.info('Finalizing and activating site', ctx)
    await callProvisionerApi(siteId, 'activate')

    // Done
    await job.updateProgress(100)
    workerLogger.info('Site provisioning completed', ctx)

    return {
      siteId,
      provisionedAt: new Date().toISOString(),
      status: 'provisioned',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    workerLogger.error('Site provisioning failed', {
      ...ctx,
      error,
    })

    // Alert superadmin on failure
    await alertSuperadmin(siteId, errorMessage)

    throw error
  }
}

// ── Worker instance ──

export const siteProvisionWorker = new Worker<SiteProvisionJobData, SiteProvisionResult>(
  QUEUE_NAMES.SITE_PROVISION,
  processSiteProvision,
  {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60_000 },
  },
)

siteProvisionWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    siteId: job.data.siteId,
  })
})

siteProvisionWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    siteId: job?.data.siteId,
    error,
  })
})
