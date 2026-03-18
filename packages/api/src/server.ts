import cors from '@fastify/cors'
import Fastify from 'fastify'

const PORT = Number(process.env.PORT) || 3010

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

app.get('/health', async () => {
  return { status: 'ok', service: 'wapixia-api', timestamp: new Date().toISOString() }
})

app.get('/api/v1/me', async (_request, reply) => {
  reply.code(401)
  return { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } }
})

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`API running on http://localhost:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
