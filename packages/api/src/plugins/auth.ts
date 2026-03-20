import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'

export interface AuthUser {
  id: string
  email: string
  organizationId: string
  role: string
  orgType: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('user', null)

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health check
    if (request.url === '/health') return

    // Skip auth for webhook routes (they use their own verification)
    if (request.url.startsWith('/api/v1/webhooks/')) return

    // Skip auth if route config has skipAuth: true
    const routeConfig = (request.routeOptions?.config ?? {}) as Record<string, unknown>
    if (routeConfig.skipAuth === true) return

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Token manquant' },
      })
    }

    const token = authHeader.slice(7)

    try {
      const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as jwt.JwtPayload

      request.user = {
        id: decoded.sub ?? '',
        email: decoded.email as string ?? '',
        organizationId: (decoded.organization_id as string) ?? '',
        role: (decoded.role as string) ?? '',
        orgType: (decoded.org_type as string) ?? '',
      }
    } catch {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Token invalide ou expiré' },
      })
    }
  })
}

export const authPluginRegistration = fp(authPlugin, {
  name: 'auth',
})

/**
 * Factory de preHandler pour vérifier les rôles
 * Usage: { preHandler: requireRole(['superadmin', 'reseller_admin']) }
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Accès refusé pour ce rôle' },
      })
    }
  }
}
