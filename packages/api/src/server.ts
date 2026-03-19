import 'dotenv/config'
import Fastify from 'fastify'
import { env } from './env.js'
import { authPluginRegistration } from './plugins/auth.js'
import { corsPluginRegistration } from './plugins/cors.js'
import { rateLimitPluginRegistration } from './plugins/rate-limit.js'
import { meRoutes } from './routes/auth/me.js'
import { inviteRoutes } from './routes/auth/invite.js'
import { organizationsRoutes } from './routes/organizations/index.js'

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'warn' : env.NODE_ENV === 'staging' ? 'info' : 'debug',
  },
})

// Plugins
await app.register(corsPluginRegistration)
await app.register(rateLimitPluginRegistration)
await app.register(authPluginRegistration)

// Health check (no auth)
app.get('/health', async () => ({
  status: 'ok',
  service: 'wapixia-api',
  timestamp: new Date().toISOString(),
}))

// Routes
await app.register(meRoutes)
await app.register(inviteRoutes)
await app.register(organizationsRoutes)

// Start
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  app.log.info(`🚀 API running on http://localhost:${env.PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
