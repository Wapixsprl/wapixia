import pino, { type Logger, type LoggerOptions } from 'pino'
import { env } from '../env.js'

// ── Log level by environment ──

const LOG_LEVELS: Record<string, string> = {
  production: 'warn',
  staging: 'info',
  development: 'debug',
}

// ── PII-safe serializers ──

const serializers: LoggerOptions['serializers'] = {
  req(request: Record<string, unknown>) {
    return {
      method: request['method'],
      url: request['url'],
      hostname: request['hostname'],
      remoteAddress: request['remoteAddress'],
    }
  },
  res(response: Record<string, unknown>) {
    return {
      statusCode: response['statusCode'],
    }
  },
  err: pino.stdSerializers.err,
}

// ── Transports ──

function buildTransport(): LoggerOptions['transport'] | undefined {
  const targets: pino.TransportTargetOptions[] = []

  // Pretty-print in dev
  if (env.NODE_ENV === 'development') {
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l' },
      level: 'debug',
    })
  }

  // Betterstack (Logtail) when token is set
  const betterstackToken = process.env['BETTERSTACK_TOKEN']
  if (betterstackToken) {
    targets.push({
      target: '@logtail/pino',
      options: { sourceToken: betterstackToken },
      level: 'info',
    })
  }

  if (targets.length === 0) return undefined
  return { targets }
}

// ── Logger singleton ──

export const logger: Logger = pino({
  level: LOG_LEVELS[env.NODE_ENV] ?? 'debug',
  serializers,
  transport: buildTransport(),
  base: {
    service: 'wapixia-api',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

// ── Business event helper ──

interface BusinessEvent {
  event: string
  siteId?: string
  organizationId?: string
  userId?: string
  module?: string
  meta?: Record<string, unknown>
}

/**
 * Log a structured business event (content generated, site published, etc.)
 * Always logged at "info" level so it reaches Betterstack in staging/prod.
 */
export function logBusinessEvent(payload: BusinessEvent): void {
  logger.info(
    {
      businessEvent: true,
      event: payload.event,
      siteId: payload.siteId,
      organizationId: payload.organizationId,
      userId: payload.userId,
      module: payload.module,
      ...payload.meta,
    },
    `biz:${payload.event}`,
  )
}
