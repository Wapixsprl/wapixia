import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { env } from '../../env.js'

export async function meRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/me', async (request, reply) => {
    const { user } = request

    // Use user's JWT for RLS-scoped queries
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: request.headers.authorization ?? '',
        },
      },
    })

    const { data: profile, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        phone,
        avatar_url,
        language,
        timezone,
        notif_email,
        notif_sms,
        notif_push,
        organization_id,
        organizations (
          id,
          name,
          slug,
          type,
          status,
          white_label_name,
          white_label_logo_url,
          white_label_primary
        )
      `)
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Profil utilisateur introuvable' },
      })
    }

    return reply.send({
      data: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role,
        phone: profile.phone,
        avatarUrl: profile.avatar_url,
        language: profile.language,
        timezone: profile.timezone,
        notifications: {
          email: profile.notif_email,
          sms: profile.notif_sms,
          push: profile.notif_push,
        },
        organizationId: profile.organization_id,
        organization: profile.organizations,
      },
    })
  })
}
