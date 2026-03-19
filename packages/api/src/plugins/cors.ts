import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { env } from '../env.js'

async function corsPlugin(fastify: FastifyInstance) {
  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim())

  await fastify.register(cors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
}

export const corsPluginRegistration = fp(corsPlugin, {
  name: 'cors',
})
