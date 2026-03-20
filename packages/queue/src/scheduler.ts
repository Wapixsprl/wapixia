// @wapixia/queue — Cron scheduler for recurring jobs

import cron from 'node-cron'
import { socialQueue, gmbQueue, blogQueue, publishQueue, alertQueue, billingRecurringQueue, dunningQueue, commissionQueue } from './queues.js'
import { createSupabaseClient } from './services/supabase.js'
import { workerLogger } from './logger.js'

const SCHEDULER_NAME = 'scheduler'

function log(message: string, extra?: Record<string, unknown>): void {
  workerLogger.info(message, { worker: SCHEDULER_NAME, jobId: 'cron', ...extra })
}

function logError(message: string, error: unknown): void {
  workerLogger.error(message, { worker: SCHEDULER_NAME, jobId: 'cron', error })
}

// ── Scheduler tasks ──

/**
 * Sync GMB reviews for all active sites with a GMB location ID.
 * Runs every 4 hours.
 */
async function syncGmbReviews(): Promise<void> {
  log('Syncing GMB reviews for all active sites')

  const supabase = createSupabaseClient()

  const { data: sites, error } = await supabase
    .from('sites')
    .select('id')
    .not('gmb_location_id', 'is', null)
    .eq('status', 'live')

  if (error) {
    logError('Failed to fetch sites for GMB sync', error)
    return
  }

  if (!sites || sites.length === 0) {
    log('No sites with GMB location ID found')
    return
  }

  log(`Found ${sites.length} sites for GMB review sync`)

  // GMB review sync is handled by a separate service/API call
  // Here we just log it; the actual sync endpoint will be called in Sprint 5
  for (const site of sites) {
    log('GMB review sync scheduled', { siteId: site.id as string })
  }
}

/**
 * Generate GMB posts for all active sites.
 * Runs every Monday at 8:00 AM.
 */
async function scheduleGmbPosts(): Promise<void> {
  log('Scheduling GMB posts for active sites')

  const supabase = createSupabaseClient()

  const { data: sites, error } = await supabase
    .from('sites')
    .select('id')
    .not('gmb_location_id', 'is', null)
    .eq('status', 'live')

  if (error) {
    logError('Failed to fetch sites for GMB posts', error)
    return
  }

  if (!sites || sites.length === 0) {
    return
  }

  for (const site of sites) {
    await gmbQueue.add('gmb-post', { siteId: site.id as string }, {
      jobId: `gmb-post-${site.id}-${Date.now()}`,
    })
  }

  log(`Queued ${sites.length} GMB post generation jobs`)
}

/**
 * Check site configs and schedule social posts.
 * Runs every hour; only enqueues if the site is due for a post.
 */
async function scheduleSocialPosts(): Promise<void> {
  log('Checking social post schedule for active sites')

  const supabase = createSupabaseClient()

  const { data: sites, error } = await supabase
    .from('sites')
    .select('id, onboarding_data')
    .eq('status', 'live')

  if (error) {
    logError('Failed to fetch sites for social posts', error)
    return
  }

  if (!sites || sites.length === 0) {
    return
  }

  let scheduled = 0

  for (const site of sites) {
    const onboardingData = (site.onboarding_data ?? {}) as Record<string, unknown>
    const socialConfig = (onboardingData['social_posting'] ?? {}) as Record<string, unknown>
    const enabled = socialConfig['enabled'] === true

    if (!enabled) {
      continue
    }

    // Check if we already posted recently (within last 24h)
    const { data: recentContent } = await supabase
      .from('ai_contents')
      .select('id')
      .eq('site_id', site.id)
      .like('type', 'social_%')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)

    if (recentContent && recentContent.length > 0) {
      continue
    }

    const postTypes = ['facebook', 'instagram'] as const

    for (const postType of postTypes) {
      await socialQueue.add('social-post', {
        siteId: site.id as string,
        postType,
      }, {
        jobId: `social-${postType}-${site.id}-${Date.now()}`,
      })
      scheduled++
    }
  }

  if (scheduled > 0) {
    log(`Queued ${scheduled} social post generation jobs`)
  }
}

/**
 * Generate blog articles for all active sites.
 * Runs every Monday at 7:00 AM.
 */
async function scheduleBlogArticles(): Promise<void> {
  log('Scheduling blog articles for active sites')

  const supabase = createSupabaseClient()

  const { data: sites, error } = await supabase
    .from('sites')
    .select('id')
    .eq('status', 'live')

  if (error) {
    logError('Failed to fetch sites for blog articles', error)
    return
  }

  if (!sites || sites.length === 0) {
    return
  }

  for (const site of sites) {
    await blogQueue.add('blog-article', { siteId: site.id as string }, {
      jobId: `blog-article-${site.id}-${Date.now()}`,
    })
  }

  log(`Queued ${sites.length} blog article generation jobs`)
}

/**
 * Publish all approved content that has not been published yet.
 * Runs every 15 minutes.
 */
async function publishApprovedContent(): Promise<void> {
  log('Publishing approved content')

  const supabase = createSupabaseClient()

  const { data: contents, error } = await supabase
    .from('ai_contents')
    .select('id')
    .in('status', ['auto_approved', 'approved'])
    .is('published_at', null)
    .limit(50)

  if (error) {
    logError('Failed to fetch approved content for publishing', error)
    return
  }

  if (!contents || contents.length === 0) {
    return
  }

  for (const content of contents) {
    await publishQueue.add('publish', { contentId: content.id as string }, {
      jobId: `publish-${content.id}-${Date.now()}`,
    })
  }

  log(`Queued ${contents.length} content items for publishing`)
}

/**
 * Alert unreported negative reviews (rating <= 2 and not yet alerted).
 * Runs every hour.
 */
async function alertNegativeReviews(): Promise<void> {
  log('Checking for unreported negative reviews')

  const supabase = createSupabaseClient()

  const { data: reviews, error } = await supabase
    .from('google_reviews')
    .select('id, site_id')
    .lte('rating', 2)
    .eq('alert_sent', false)
    .limit(50)

  if (error) {
    logError('Failed to fetch negative reviews', error)
    return
  }

  if (!reviews || reviews.length === 0) {
    return
  }

  for (const review of reviews) {
    await alertQueue.add('alert-negative-review', {
      reviewId: review.id as string,
    }, {
      jobId: `alert-review-${review.id}-${Date.now()}`,
    })
  }

  log(`Queued ${reviews.length} negative review alerts`)
}

/**
 * Trigger monthly recurring billing for all active subscriptions.
 * Runs on the 1st of each month at 6:00 AM.
 */
async function scheduleBillingRecurring(): Promise<void> {
  log('Scheduling monthly recurring billing run')

  await billingRecurringQueue.add('billing-recurring', {}, {
    jobId: `billing-recurring-${Date.now()}`,
  })

  log('Queued billing-recurring job')
}

/**
 * Trigger monthly commission payout processing.
 * Runs on the 2nd of each month at 8:00 AM.
 * Finds all pending commissions and attempts Stripe transfers.
 */
async function scheduleMonthlyCommissions(): Promise<void> {
  log('Processing monthly pending commissions')

  const supabase = createSupabaseClient()

  const { data: pendingCommissions, error } = await supabase
    .from('commissions')
    .select('id, payment_id')
    .in('status', ['pending', 'processing'])
    .limit(200)

  if (error) {
    logError('Failed to fetch pending commissions', error)
    return
  }

  if (!pendingCommissions || pendingCommissions.length === 0) {
    log('No pending commissions to process')
    return
  }

  for (const commission of pendingCommissions) {
    await commissionQueue.add('calculate-commission', {
      paymentId: commission.payment_id as string,
    }, {
      jobId: `commission-monthly-${commission.id}-${Date.now()}`,
    })
  }

  log(`Queued ${pendingCommissions.length} commission jobs for monthly payout`)
}

/**
 * Check subscriptions in dunning state and schedule retry jobs.
 * Runs daily at 9:00 AM.
 */
async function scheduleDunningRetries(): Promise<void> {
  log('Checking for subscriptions needing dunning retry')

  const supabase = createSupabaseClient()

  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('id')
    .in('status', ['past_due', 'unpaid'])
    .limit(100)

  if (error) {
    logError('Failed to fetch dunning subscriptions', error)
    return
  }

  if (!subscriptions || subscriptions.length === 0) {
    return
  }

  for (const sub of subscriptions) {
    await dunningQueue.add('retry-payment', {
      subscriptionId: sub.id as string,
    }, {
      jobId: `dunning-${sub.id}-${Date.now()}`,
    })
  }

  log(`Queued ${subscriptions.length} dunning retry jobs`)
}

// ── Start scheduler ──

export function startScheduler(): void {
  if (process.env.CRON_ENABLED !== 'true') {
    log('CRON_ENABLED is not true, scheduler will not start')
    return
  }

  log('Starting cron scheduler')

  // Sync GMB reviews every 4 hours
  cron.schedule('0 */4 * * *', () => {
    syncGmbReviews().catch((err: unknown) => logError('syncGmbReviews failed', err))
  })

  // GMB posts every Monday at 8:00 AM
  cron.schedule('0 8 * * 1', () => {
    scheduleGmbPosts().catch((err: unknown) => logError('scheduleGmbPosts failed', err))
  })

  // Social posts: hourly check based on site config
  cron.schedule('0 * * * *', () => {
    scheduleSocialPosts().catch((err: unknown) => logError('scheduleSocialPosts failed', err))
  })

  // Blog articles: every Monday at 7:00 AM
  cron.schedule('0 7 * * 1', () => {
    scheduleBlogArticles().catch((err: unknown) => logError('scheduleBlogArticles failed', err))
  })

  // Publish approved content: every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    publishApprovedContent().catch((err: unknown) => logError('publishApprovedContent failed', err))
  })

  // Alert unreported negative reviews: every hour
  cron.schedule('30 * * * *', () => {
    alertNegativeReviews().catch((err: unknown) => logError('alertNegativeReviews failed', err))
  })

  // Billing recurring: 1st of each month at 6:00 AM
  cron.schedule('0 6 1 * *', () => {
    scheduleBillingRecurring().catch((err: unknown) => logError('scheduleBillingRecurring failed', err))
  })

  // Monthly commissions payout: 2nd of each month at 8:00 AM
  cron.schedule('0 8 2 * *', () => {
    scheduleMonthlyCommissions().catch((err: unknown) => logError('scheduleMonthlyCommissions failed', err))
  })

  // Dunning retries: daily at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    scheduleDunningRetries().catch((err: unknown) => logError('scheduleDunningRetries failed', err))
  })

  log('All cron jobs registered')
}
