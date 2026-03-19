// @wapixia/queue — Content publisher worker

import { Worker, type Job } from 'bullmq'
import { connection, QUEUE_NAMES } from '../config.js'
import type { PublishJobData, PublishResult } from '../types.js'
import { workerLogger } from '../logger.js'
import { createSupabaseClient } from '../services/supabase.js'

const WORKER_NAME = 'publish'

/**
 * Content type to platform mapping.
 */
type Platform = 'facebook' | 'instagram' | 'linkedin' | 'gmb' | 'blog'

function getTargetPlatform(contentType: string): Platform {
  if (contentType === 'social_facebook') return 'facebook'
  if (contentType === 'social_instagram') return 'instagram'
  if (contentType === 'social_linkedin') return 'linkedin'
  if (contentType === 'gmb_post') return 'gmb'
  if (contentType === 'blog_article') return 'blog'
  throw new Error(`Unknown content type for publishing: ${contentType}`)
}

/**
 * Publish to Facebook/Instagram via Meta Graph API.
 * Sprint 5: real integration. Currently a stub.
 */
async function publishToMeta(
  platform: 'facebook' | 'instagram',
  _content: Record<string, unknown>,
  _siteId: string,
): Promise<{ externalId: string; externalUrl: string }> {
  workerLogger.info(`STUB: Publishing to ${platform}`, {
    worker: WORKER_NAME,
    jobId: 'n/a',
    siteId: _siteId,
  })
  // Stub - will be replaced with real Meta Graph API calls in Sprint 5
  return {
    externalId: `meta-stub-${Date.now()}`,
    externalUrl: `https://${platform}.com/stub/${Date.now()}`,
  }
}

/**
 * Publish to Google My Business.
 * Sprint 5: real integration. Currently a stub.
 */
async function publishToGmb(
  _content: Record<string, unknown>,
  _siteId: string,
  _gmbLocationId: string,
): Promise<{ externalId: string; externalUrl: string }> {
  workerLogger.info('STUB: Publishing to GMB', {
    worker: WORKER_NAME,
    jobId: 'n/a',
    siteId: _siteId,
  })
  return {
    externalId: `gmb-stub-${Date.now()}`,
    externalUrl: `https://business.google.com/stub/${Date.now()}`,
  }
}

/**
 * Publish blog article to CMS.
 * Sprint 5: real integration. Currently a stub.
 */
async function publishToBlog(
  _content: Record<string, unknown>,
  _siteId: string,
): Promise<{ externalId: string; externalUrl: string }> {
  workerLogger.info('STUB: Publishing blog article', {
    worker: WORKER_NAME,
    jobId: 'n/a',
    siteId: _siteId,
  })
  return {
    externalId: `blog-stub-${Date.now()}`,
    externalUrl: `/blog/stub-${Date.now()}`,
  }
}

async function processPublish(
  job: Job<PublishJobData>,
): Promise<PublishResult> {
  const { contentId } = job.data
  const jobId = job.id ?? 'unknown'
  const ctx = { worker: WORKER_NAME, jobId, contentId }

  workerLogger.info('Starting content publishing', ctx)

  const supabase = createSupabaseClient()

  // Load the ai_content record
  const { data: aiContent, error: contentError } = await supabase
    .from('ai_contents')
    .select('*')
    .eq('id', contentId)
    .single()

  if (contentError || !aiContent) {
    throw new Error(`Content not found: ${contentId}`)
  }

  // Only publish approved content
  const validStatuses = ['auto_approved', 'approved']
  if (!validStatuses.includes(aiContent.status as string)) {
    workerLogger.warn('Content is not approved for publishing', {
      ...ctx,
      siteId: aiContent.site_id as string,
    })
    return {
      contentId,
      status: 'publish_failed',
    }
  }

  const siteId = aiContent.site_id as string
  const contentType = aiContent.type as string
  const contentData = (aiContent.content ?? {}) as Record<string, unknown>

  try {
    const platform = getTargetPlatform(contentType)
    let result: { externalId: string; externalUrl: string }

    switch (platform) {
      case 'facebook':
      case 'instagram': {
        result = await publishToMeta(platform, contentData, siteId)
        break
      }
      case 'linkedin': {
        // LinkedIn publishing stub - Sprint 6
        result = {
          externalId: `linkedin-stub-${Date.now()}`,
          externalUrl: `https://linkedin.com/stub/${Date.now()}`,
        }
        break
      }
      case 'gmb': {
        // Load GMB location ID
        const { data: site } = await supabase
          .from('sites')
          .select('gmb_location_id')
          .eq('id', siteId)
          .single()

        const gmbLocationId = (site?.gmb_location_id as string) ?? ''
        result = await publishToGmb(contentData, siteId, gmbLocationId)
        break
      }
      case 'blog': {
        result = await publishToBlog(contentData, siteId)
        break
      }
    }

    // Update the ai_content record with publish info
    const { error: updateError } = await supabase
      .from('ai_contents')
      .update({
        status: 'published',
        external_id: result.externalId,
        external_url: result.externalUrl,
        published_at: new Date().toISOString(),
      })
      .eq('id', contentId)

    if (updateError) {
      throw new Error(`Failed to update content status: ${updateError.message}`)
    }

    workerLogger.info('Content published successfully', {
      ...ctx,
      siteId,
    })

    return {
      contentId,
      externalId: result.externalId,
      externalUrl: result.externalUrl,
      status: 'published',
    }
  } catch (error) {
    // Mark as publish_failed
    await supabase
      .from('ai_contents')
      .update({
        status: 'publish_failed',
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq('id', contentId)

    workerLogger.error('Content publishing failed', {
      ...ctx,
      siteId,
      error,
    })

    throw error
  }
}

// ── Worker instance ──

export const publishWorker = new Worker<PublishJobData, PublishResult>(
  QUEUE_NAMES.PUBLISH,
  processPublish,
  {
    connection,
    concurrency: 5,
    limiter: { max: 30, duration: 60_000 },
  },
)

publishWorker.on('completed', (job) => {
  workerLogger.info('Job completed', {
    worker: WORKER_NAME,
    jobId: job.id ?? 'unknown',
    contentId: job.data.contentId,
  })
})

publishWorker.on('failed', (job, error) => {
  workerLogger.error('Job failed', {
    worker: WORKER_NAME,
    jobId: job?.id ?? 'unknown',
    contentId: job?.data.contentId,
    error,
  })
})
