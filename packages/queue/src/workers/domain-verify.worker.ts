// @wapixia/queue — Domain verification worker
// Processes domain:verify jobs by checking DNS propagation.
// If verified: activates domain and removes repeating job.
// If not: lets BullMQ repeat (every 5 min, max 72h).

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { DomainVerifyJobData } from '../types.js'
import { workerLogger } from '../logger.js'

const WORKER_NAME = 'domain-verify'

/** Maximum verification window: 72 hours in milliseconds */
const MAX_VERIFY_DURATION_MS = 72 * 60 * 60 * 1000

/** Result returned by the verification process */
interface DomainVerifyResult {
  siteId: string
  domain: string
  verified: boolean
  checkedAt: string
}

/**
 * Call the domain manager service to check DNS propagation.
 */
async function checkDnsPropagation(
  siteId: string,
  domain: string,
): Promise<{ verified: boolean; details: string }> {
  const baseUrl = process.env.DOMAIN_MANAGER_API_URL

  if (!baseUrl || baseUrl === 'stub') {
    workerLogger.info('STUB: DNS propagation check', {
      worker: WORKER_NAME,
      jobId: 'n/a',
      siteId,
    })
    // In stub mode, simulate verified after a random check
    return { verified: true, details: 'stub:dns-ok' }
  }

  const response = await fetch(`${baseUrl}/domains/${domain}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DOMAIN_MANAGER_API_SECRET ?? ''}`,
    },
    body: JSON.stringify({ siteId, domain }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Domain Manager API error (${response.status}): ${errorText}`)
  }

  return (await response.json()) as { verified: boolean; details: string }
}

/**
 * Activate the domain in the domain manager after successful verification.
 */
async function activateDomain(
  siteId: string,
  domain: string,
): Promise<void> {
  const baseUrl = process.env.DOMAIN_MANAGER_API_URL

  if (!baseUrl || baseUrl === 'stub') {
    workerLogger.info('STUB: Domain activation', {
      worker: WORKER_NAME,
      jobId: 'n/a',
      siteId,
    })
    return
  }

  const response = await fetch(`${baseUrl}/domains/${domain}/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DOMAIN_MANAGER_API_SECRET ?? ''}`,
    },
    body: JSON.stringify({ siteId, domain }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Domain activation failed (${response.status}): ${errorText}`)
  }
}

/**
 * Process a domain verification job.
 * Returns the verification result. If not verified, throws to trigger
 * BullMQ retry on the repeatable schedule.
 */
async function processDomainVerify(
  job: Job<DomainVerifyJobData>,
): Promise<DomainVerifyResult> {
  const { siteId, domain } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, siteId }

  workerLogger.info(`Checking DNS propagation for ${domain}`, ctx)

  // Check if we've exceeded the 72h verification window
  const jobCreatedAt = job.timestamp
  const elapsed = Date.now() - jobCreatedAt

  if (elapsed > MAX_VERIFY_DURATION_MS) {
    workerLogger.warn(`Domain verification timed out after 72h: ${domain}`, ctx)

    // Remove the repeatable job since we've exceeded the window
    const queue = job.queue
    if (queue) {
      const repeatableJobs = await queue.getRepeatableJobs()
      const matchingJob = repeatableJobs.find(
        (rj) => rj.name === job.name && rj.id === job.repeatJobKey,
      )
      if (matchingJob) {
        await queue.removeRepeatableByKey(matchingJob.key)
        workerLogger.info(`Removed repeatable job for ${domain}`, ctx)
      }
    }

    return {
      siteId,
      domain,
      verified: false,
      checkedAt: new Date().toISOString(),
    }
  }

  // Check DNS propagation
  const result = await checkDnsPropagation(siteId, domain)

  if (result.verified) {
    workerLogger.info(`Domain verified: ${domain}`, ctx)

    // Activate the domain
    await activateDomain(siteId, domain)
    workerLogger.info(`Domain activated: ${domain}`, ctx)

    // Remove the repeatable job since verification is complete
    const queue = job.queue
    if (queue) {
      const repeatableJobs = await queue.getRepeatableJobs()
      const matchingJob = repeatableJobs.find(
        (rj) => rj.name === job.name && rj.id === job.repeatJobKey,
      )
      if (matchingJob) {
        await queue.removeRepeatableByKey(matchingJob.key)
        workerLogger.info(`Removed repeatable job for ${domain}`, ctx)
      }
    }

    return {
      siteId,
      domain,
      verified: true,
      checkedAt: new Date().toISOString(),
    }
  }

  // Not verified yet — let BullMQ repeat handle the next check
  workerLogger.info(
    `DNS not yet propagated for ${domain}, will retry (${result.details})`,
    ctx,
  )

  // Throw a specific error so BullMQ marks this attempt as failed
  // and the repeatable schedule will trigger the next check
  throw new Error(`DNS not yet propagated for ${domain}: ${result.details}`)
}

// ── Worker instance ──

export const domainVerifyWorker = new Worker<DomainVerifyJobData, DomainVerifyResult>(
  QUEUE_NAMES.DOMAIN_VERIFY,
  processDomainVerify,
  {
    connection,
    concurrency: 10,
    limiter: { max: 60, duration: 60_000 },
  },
)

domainVerifyWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    siteId: job.data.siteId,
  })
})

domainVerifyWorker.on('failed', (job, error) => {
  // DNS-not-propagated failures are expected; log at info level
  const isDnsPending =
    error.message.includes('DNS not yet propagated')

  if (isDnsPending) {
    workerLogger.info('DNS check pending, will retry', {
      worker: WORKER_NAME,
      jobId: job?.id ?? 'unknown',
      siteId: job?.data.siteId,
    })
  } else {
    workerLogger.error('Job failed', {
      worker: WORKER_NAME,
      jobId: job?.id ?? 'unknown',
      siteId: job?.data.siteId,
      error,
    })
  }
})
