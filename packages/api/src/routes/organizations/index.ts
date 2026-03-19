import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { env } from '../../env.js'

export async function organizationsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/organizations — RLS handles scoping
  fastify.get('/api/v1/organizations', async (request, reply) => {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: request.headers.authorization ?? '',
        },
      },
    })

    const { data: organizations, error } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        slug,
        type,
        status,
        commission_rate,
        white_label_name,
        white_label_domain,
        parent_id,
        created_at
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      fastify.log.error({ error: error.message }, 'Erreur récupération organisations')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' },
      })
    }

    return reply.send({
      data: organizations,
      meta: { total: organizations?.length ?? 0 },
    })
  })

  // GET /api/v1/organizations/:id
  fastify.get('/api/v1/organizations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: request.headers.authorization ?? '',
        },
      },
    })

    const { data: org, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !org) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organisation introuvable' },
      })
    }

    return reply.send({ data: org })
  })
}
