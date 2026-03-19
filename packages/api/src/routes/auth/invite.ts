import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'
import { requireRole } from '../../plugins/auth.js'

const InviteSchema = z.object({
  email: z.string().email('Email invalide'),
  role: z.enum([
    'superadmin',
    'reseller_admin',
    'reseller_user',
    'client_admin',
    'client_user',
  ]),
  organizationId: z.string().uuid('Organization ID invalide'),
})

export async function inviteRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/v1/auth/invite',
    {
      preHandler: requireRole([
        'superadmin',
        'reseller_admin',
        'client_admin',
      ]),
    },
    async (request, reply) => {
      const parseResult = InviteSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données invalides',
            details: parseResult.error.flatten().fieldErrors,
          },
        })
      }

      const { email, role, organizationId } = parseResult.data
      const { user } = request

      // Reseller can only invite to their own org or child orgs
      if (user.orgType === 'reseller') {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

        const { data: targetOrg } = await supabase
          .from('organizations')
          .select('id, parent_id')
          .eq('id', organizationId)
          .single()

        if (!targetOrg) {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Organisation introuvable' },
          })
        }

        const isOwnOrg = targetOrg.id === user.organizationId
        const isChildOrg = targetOrg.parent_id === user.organizationId

        if (!isOwnOrg && !isChildOrg) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Vous ne pouvez inviter que dans votre organisation ou vos clients',
            },
          })
        }
      }

      // Client admin can only invite to their own org
      if (user.orgType === 'direct' && organizationId !== user.organizationId) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Vous ne pouvez inviter que dans votre organisation',
          },
        })
      }

      // Use service_role for admin operations
      const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: {
            organization_id: organizationId,
            role,
          },
          redirectTo: `${env.CORS_ORIGINS.split(',')[0]}/auth/callback`,
        })

      if (inviteError) {
        fastify.log.error({ error: inviteError.message }, 'Erreur invitation utilisateur')
        return reply.status(400).send({
          error: {
            code: 'INVITE_FAILED',
            message: inviteError.message,
          },
        })
      }

      // Create user record in our users table
      if (inviteData.user) {
        const { error: insertError } = await adminClient
          .from('users')
          .insert({
            id: inviteData.user.id,
            organization_id: organizationId,
            role,
            email,
          })

        if (insertError) {
          fastify.log.error({ error: insertError.message }, 'Erreur création profil utilisateur')
        }
      }

      return reply.status(201).send({
        data: {
          userId: inviteData.user?.id,
          email,
          role,
        },
      })
    },
  )
}
