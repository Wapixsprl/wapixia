// @wapixia/queue — Queue instances

import { createQueue, QUEUE_NAMES } from './config.js'
import type {
  SocialPostJobData,
  BlogArticleJobData,
  GmbPostJobData,
  ReviewReplyJobData,
  PublishJobData,
  EmailJobData,
  AlertJobData,
  SiteGenerateJobData,
  SiteProvisionJobData,
  DomainVerifyJobData,
} from './types.js'

// ── Content generation queues ──

export const socialQueue = createQueue<SocialPostJobData>(QUEUE_NAMES.SOCIAL)
export const gmbQueue = createQueue<GmbPostJobData>(QUEUE_NAMES.GMB)
export const blogQueue = createQueue<BlogArticleJobData>(QUEUE_NAMES.BLOG)

// ── Reputation queue ──

export const reviewsQueue = createQueue<ReviewReplyJobData>(QUEUE_NAMES.REVIEWS)

// ── Publishing queue ──

export const publishQueue = createQueue<PublishJobData>(QUEUE_NAMES.PUBLISH)

// ── Notification queues ──

export const emailQueue = createQueue<EmailJobData>(QUEUE_NAMES.EMAIL)
export const alertQueue = createQueue<AlertJobData>(QUEUE_NAMES.ALERT)

// ── Site generation queue ──

export const siteGenerateQueue = createQueue<SiteGenerateJobData>(QUEUE_NAMES.SITE_GENERATE)

// ── Infrastructure queues ──

export const siteProvisionQueue = createQueue<SiteProvisionJobData>(QUEUE_NAMES.SITE_PROVISION)
export const domainVerifyQueue = createQueue<DomainVerifyJobData>(QUEUE_NAMES.DOMAIN_VERIFY)
