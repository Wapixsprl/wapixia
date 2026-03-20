// @wapixia/queue — BullMQ configuration and queue factory

import { Queue, type JobsOptions } from 'bullmq'
import IORedis from 'ioredis'

// ── Redis connection ──

export const connection = new IORedis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
)

// ── Queue names ──

export const QUEUE_NAMES = {
  SOCIAL: 'content:social',
  GMB: 'content:gmb',
  BLOG: 'content:blog',
  REVIEWS: 'reputation:reviews',
  PUBLISH: 'sites:publish',
  EMAIL: 'notifications:email',
  SMS: 'notifications:sms',
  ALERT: 'notifications:alert',
  SITE_GENERATE: 'sites:generate',
  MONTHLY_REPORT: 'reports:monthly',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

// ── Default job options per queue ──

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 },
}

const QUEUE_JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  [QUEUE_NAMES.SOCIAL]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  },
  [QUEUE_NAMES.GMB]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  },
  [QUEUE_NAMES.BLOG]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  [QUEUE_NAMES.REVIEWS]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
  },
  [QUEUE_NAMES.PUBLISH]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 5,
    backoff: { type: 'exponential', delay: 15_000 },
  },
  [QUEUE_NAMES.EMAIL]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 5,
    backoff: { type: 'exponential', delay: 10_000 },
  },
  [QUEUE_NAMES.SMS]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  },
  [QUEUE_NAMES.ALERT]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 5,
    backoff: { type: 'exponential', delay: 10_000 },
  },
  [QUEUE_NAMES.SITE_GENERATE]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
  },
  [QUEUE_NAMES.MONTHLY_REPORT]: {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
  },
}

// ── Queue factory ──

const queueCache = new Map<QueueName, Queue>()

/**
 * Create (or retrieve cached) a BullMQ Queue for the given queue name.
 * Applies queue-specific default job options.
 */
export function createQueue<TData = unknown>(name: QueueName): Queue<TData> {
  const existing = queueCache.get(name)
  if (existing) {
    return existing as Queue<TData>
  }

  const queue = new Queue<TData>(name, {
    connection,
    defaultJobOptions: QUEUE_JOB_OPTIONS[name],
  })

  queueCache.set(name, queue as Queue)
  return queue
}
