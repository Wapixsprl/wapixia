import 'dotenv/config'
import Fastify from 'fastify'
import { env } from './env.js'
import { logger } from './lib/logger.js'
import { authPluginRegistration } from './plugins/auth.js'
import { corsPluginRegistration } from './plugins/cors.js'
import { rateLimitPluginRegistration } from './plugins/rate-limit.js'
import { healthRoutes } from './routes/health.js'
import { alertRoutes } from './routes/internal/alerts.js'
import { meRoutes } from './routes/auth/me.js'
import { inviteRoutes } from './routes/auth/invite.js'
import { organizationsRoutes } from './routes/organizations/index.js'
import { sitesRoutes } from './routes/sites/index.js'
import { onboardingRoutes } from './routes/sites/onboarding.js'
import { domainRoutes } from './routes/sites/domain.js'
import { googleRoutes } from './routes/sites/google.js'
import { modulesRoutes } from './routes/modules/index.js'
import { contentsRoutes } from './routes/contents/index.js'
import { reviewsRoutes } from './routes/reviews/index.js'
import { socialRoutes } from './routes/social/index.js'

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'warn' : env.NODE_ENV === 'staging' ? 'info' : 'debug',
  },
})

// Health check — registered BEFORE auth plugin (no auth needed)
await app.register(healthRoutes)

// Plugins
await app.register(corsPluginRegistration)
await app.register(rateLimitPluginRegistration)
await app.register(authPluginRegistration)

// Internal routes (use their own auth via x-internal-secret header)
await app.register(alertRoutes)

// Routes
await app.register(meRoutes)
await app.register(inviteRoutes)
await app.register(organizationsRoutes)
await app.register(sitesRoutes)
await app.register(onboardingRoutes)
await app.register(domainRoutes)
await app.register(googleRoutes)
await app.register(modulesRoutes)
await app.register(contentsRoutes)
await app.register(reviewsRoutes)
await app.register(socialRoutes)

// Start
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  logger.info(`API running on http://localhost:${env.PORT}`)
} catch (err) {
  logger.error(err, 'Failed to start API server')
  process.exit(1)
}
