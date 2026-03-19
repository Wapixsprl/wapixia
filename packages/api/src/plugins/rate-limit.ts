import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Trop de requêtes, réessayez dans un instant',
      },
    }),
  })
}

export const rateLimitPluginRegistration = fp(rateLimitPlugin, {
  name: 'rate-limit',
})
