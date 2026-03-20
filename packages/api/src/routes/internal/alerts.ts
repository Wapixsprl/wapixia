import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { logger } from '../../lib/logger.js'

// ── Types ──

const ALERT_TYPES = [
  'backup_success',
  'backup_failure',
  'site_down',
  'deploy_success',
  'deploy_failure',
] as const

type AlertType = (typeof ALERT_TYPES)[number]

const alertBodySchema = z.object({
  type: z.enum(ALERT_TYPES),
  source: z.string().min(1),
  message: z.string().min(1),
  meta: z.record(z.unknown()).optional(),
})

type AlertBody = z.infer<typeof alertBodySchema>

// ── Helpers ──

const INTERNAL_SECRET = process.env['INTERNAL_ALERT_SECRET']
const BREVO_API_KEY = process.env['BREVO_API_KEY']
const ADMIN_EMAIL = process.env['ADMIN_ALERT_EMAIL'] ?? 'alerts@wapixia.com'
const SENDER_EMAIL = process.env['BREVO_SENDER_EMAIL'] ?? 'noreply@wapixia.com'

function isFailureAlert(type: AlertType): boolean {
  return type === 'backup_failure' || type === 'site_down' || type === 'deploy_failure'
}

async function sendAlertEmail(alert: AlertBody): Promise<void> {
  if (!BREVO_API_KEY) {
    logger.warn({ alert }, 'BREVO_API_KEY not set — alert email skipped')
    return
  }

  const emoji = isFailureAlert(alert.type) ? '[ALERT]' : '[INFO]'
  const subject = `${emoji} WapixIA — ${alert.type.replace(/_/g, ' ')} from ${alert.source}`

  const htmlContent = `
    <h2>WapixIA Alert</h2>
    <table style="border-collapse:collapse;">
      <tr><td><strong>Type:</strong></td><td>${alert.type}</td></tr>
      <tr><td><strong>Source:</strong></td><td>${alert.source}</td></tr>
      <tr><td><strong>Message:</strong></td><td>${alert.message}</td></tr>
      <tr><td><strong>Time:</strong></td><td>${new Date().toISOString()}</td></tr>
      ${alert.meta ? `<tr><td><strong>Meta:</strong></td><td><pre>${JSON.stringify(alert.meta, null, 2)}</pre></td></tr>` : ''}
    </table>
  `.trim()

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: 'WapixIA Alerts' },
      to: [{ email: ADMIN_EMAIL }],
      subject,
      htmlContent,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    logger.error({ status: response.status, body: text }, 'Failed to send alert email via Brevo')
  }
}

// ── Route ──

export async function alertRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/internal/alerts', async (request, reply) => {
    // Validate internal secret
    const authHeader = request.headers['x-internal-secret']
    if (!INTERNAL_SECRET) {
      logger.error('INTERNAL_ALERT_SECRET not configured — rejecting all alert requests')
      return reply.status(503).send({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Alert service not configured' },
      })
    }

    if (authHeader !== INTERNAL_SECRET) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Invalid internal secret' },
      })
    }

    // Validate body
    const parsed = alertBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid alert payload',
          details: parsed.error.flatten().fieldErrors,
        },
      })
    }

    const alert = parsed.data

    // Log the alert
    const logLevel = isFailureAlert(alert.type) ? 'error' : 'info'
    logger[logLevel](
      { alertType: alert.type, source: alert.source, meta: alert.meta },
      `alert:${alert.type} — ${alert.message}`,
    )

    // Forward to admin via email (fire-and-forget for non-critical, await for failures)
    if (isFailureAlert(alert.type)) {
      await sendAlertEmail(alert)
    } else {
      sendAlertEmail(alert).catch((err) => {
        logger.error({ err }, 'Failed to send non-critical alert email')
      })
    }

    return reply.status(200).send({
      data: { received: true, type: alert.type, timestamp: new Date().toISOString() },
    })
  })
}
