// @wapixia/queue — BullMQ queues, workers et scheduler

// Config
export { connection, QUEUE_NAMES, createQueue } from './config.js'
export type { QueueName } from './config.js'

// Types
export type {
  SocialPostJobData,
  BlogArticleJobData,
  GmbPostJobData,
  ReviewReplyJobData,
  PublishJobData,
  EmailJobData,
  AlertJobData,
  SiteGenerateJobData,
  ContentGenerationResult,
  PublishResult,
  AlertResult,
} from './types.js'

// Queue instances
export {
  socialQueue,
  gmbQueue,
  blogQueue,
  reviewsQueue,
  publishQueue,
  emailQueue,
  alertQueue,
  siteGenerateQueue,
} from './queues.js'

// Workers
export { socialPostWorker } from './workers/social-post.worker.js'
export { blogArticleWorker } from './workers/blog-article.worker.js'
export { gmbPostWorker } from './workers/gmb-post.worker.js'
export { reviewReplyWorker } from './workers/review-reply.worker.js'
export { publishWorker } from './workers/publish.worker.js'
export { alertWorker } from './workers/alert.worker.js'

// Scheduler
export { startScheduler } from './scheduler.js'

// Logger
export { workerLogger } from './logger.js'
