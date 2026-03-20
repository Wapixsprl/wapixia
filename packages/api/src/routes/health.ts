import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { env } from '../env.js'
import { logger } from '../lib/logger.js'

// ── Types ──

type ServiceStatus = 'ok' | 'error'

interface ServiceCheck {
  status: ServiceStatus
  latencyMs: number
  message?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded'
  timestamp: string
  version: string
  services: {
    database: ServiceCheck
    redis: ServiceCheck
    cloudflare: ServiceCheck
    anthropic: ServiceCheck
  }
}

// ── Helpers ──

const CHECK_TIMEOUT_MS = 5_000
const API_VERSION = process.env['npm_package_version'] ?? '0.1.0'

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} check timed out after ${CHECK_TIMEOUT_MS}ms`)), CHECK_TIMEOUT_MS),
    ),
  ])
}

async function checkDatabase(): Promise<ServiceCheck> {
  const start = performance.now()
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const { error } = await withTimeout(
      supabase.from('users').select('id').limit(1),
      'database',
    )
    const latencyMs = Math.round(performance.now() - start)
    if (error) {
      return { status: 'error', latencyMs, message: error.message }
    }
    return { status: 'ok', latencyMs }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    return { status: 'error', latencyMs, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}

async function checkRedis(): Promise<ServiceCheck> {
  const start = performance.now()
  try {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
    // Dynamic import to avoid hard dependency on ioredis at module level
    const { default: IORedis } = await import('ioredis')
    const client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: CHECK_TIMEOUT_MS,
      lazyConnect: true,
    })
    await client.connect()
    const result = await withTimeout(client.ping(), 'redis')
    const latencyMs = Math.round(performance.now() - start)
    await client.quit()
    if (result !== 'PONG') {
      return { status: 'error', latencyMs, message: `Unexpected PING response: ${result}` }
    }
    return { status: 'ok', latencyMs }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    return { status: 'error', latencyMs, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}

async function checkCloudflare(): Promise<ServiceCheck> {
  const start = performance.now()
  if (!env.CLOUDFLARE_API_TOKEN) {
    return { status: 'ok', latencyMs: 0, message: 'Token not configured — skipped' }
  }
  try {
    const response = await withTimeout(
      fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      }),
      'cloudflare',
    )
    const latencyMs = Math.round(performance.now() - start)
    if (!response.ok) {
      return { status: 'error', latencyMs, message: `HTTP ${response.status}` }
    }
    return { status: 'ok', latencyMs }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    return { status: 'error', latencyMs, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}

async function checkAnthropic(): Promise<ServiceCheck> {
  const start = performance.now()
  if (!env.ANTHROPIC_API_KEY) {
    return { status: 'ok', latencyMs: 0, message: 'API key not configured — skipped' }
  }
  try {
    // Lightweight models endpoint check (no tokens consumed)
    const response = await withTimeout(
      fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      }),
      'anthropic',
    )
    const latencyMs = Math.round(performance.now() - start)
    if (!response.ok) {
      return { status: 'error', latencyMs, message: `HTTP ${response.status}` }
    }
    return { status: 'ok', latencyMs }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    return { status: 'error', latencyMs, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Route ──

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    const [database, redis, cloudflare, anthropic] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkCloudflare(),
      checkAnthropic(),
    ])

    const services = { database, redis, cloudflare, anthropic }

    const hasError = Object.values(services).some(
      (s) => s.status === 'error' && !s.message?.includes('skipped'),
    )

    const response: HealthResponse = {
      status: hasError ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      services,
    }

    if (hasError) {
      logger.warn({ healthCheck: services }, 'Health check degraded')
    }

    return reply.status(hasError ? 503 : 200).send(response)
  })
}
