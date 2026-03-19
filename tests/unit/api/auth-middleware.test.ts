import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'

/**
 * Tests API — Sprint 1
 * Vérifie le middleware auth, la route /me, et le guard de rôles
 */

const JWT_SECRET = 'test-jwt-secret-for-vitest'

// Inline simplified auth plugin for unit testing (no Supabase dependency)
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  app.decorateRequest('user', null)

  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health') return

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token manquant' } })
    }

    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as jwt.JwtPayload
      request.user = {
        id: decoded.sub ?? '',
        email: decoded.email ?? '',
        organizationId: decoded.organization_id ?? '',
        role: decoded.role ?? '',
        orgType: decoded.org_type ?? '',
      }
    } catch {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token invalide' } })
    }
  })

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  // /api/v1/me — returns the decoded user
  app.get('/api/v1/me', async (request) => ({ data: request.user }))

  // Admin-only route
  app.get('/api/v1/admin-only', {
    preHandler: async (request, reply) => {
      if (request.user?.role !== 'superadmin') {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Accès refusé' } })
      }
    },
  }, async (request) => ({ data: 'admin content' }))

  return app
}

function makeToken(claims: Record<string, unknown>): string {
  return jwt.sign(
    {
      aud: 'authenticated',
      ...claims,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    JWT_SECRET,
  )
}

describe('Auth Middleware — Sprint 1', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  // ── Health check (no auth) ──

  it('T17 — /health répond 200 sans auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
  })

  // ── Auth middleware ──

  it('T18 — requête sans header Authorization retourne 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
  })

  it('T19 — token invalide retourne 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer invalid-token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('T20 — token expiré retourne 401', async () => {
    const expiredToken = jwt.sign(
      { sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 3600 },
      JWT_SECRET,
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    })
    expect(res.statusCode).toBe(401)
  })

  // ── /api/v1/me ──

  it('T21 — /me retourne le profil du superadmin', async () => {
    const token = makeToken({
      sub: 'sa-id-123',
      email: 'admin@wapixia.com',
      organization_id: 'org-wapixia',
      role: 'superadmin',
      org_type: 'wapixia',
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.role).toBe('superadmin')
    expect(body.data.organizationId).toBe('org-wapixia')
  })

  it('T22 — /me retourne le profil du client', async () => {
    const token = makeToken({
      sub: 'client-id-456',
      email: 'client@salon.be',
      organization_id: 'org-client',
      role: 'client_admin',
      org_type: 'direct',
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.role).toBe('client_admin')
  })

  // ── Role guard ──

  it('T23 — superadmin accède à la route admin-only', async () => {
    const token = makeToken({ sub: 'sa-1', role: 'superadmin', org_type: 'wapixia', organization_id: 'org-w' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('T24 — client_admin reçoit 403 sur la route admin-only', async () => {
    const token = makeToken({ sub: 'cl-1', role: 'client_admin', org_type: 'direct', organization_id: 'org-c' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
  })

  it('T25 — reseller_admin reçoit 403 sur la route admin-only', async () => {
    const token = makeToken({ sub: 'rs-1', role: 'reseller_admin', org_type: 'reseller', organization_id: 'org-r' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin-only',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
  })
})
