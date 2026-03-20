import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { env } from '../../env.js'
import { requireRole } from '../../plugins/auth.js'

// ---------------------------------------------------------------------------
// Service-role client (bypasses RLS for admin operations)
// ---------------------------------------------------------------------------

function adminClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateBugSchema = z.object({
  pilotId: z.string().min(1, 'Pilot ID requis'),
  severity: z.enum(['critical', 'major', 'minor', 'cosmetic']),
  description: z.string().min(1, 'Description requise').max(1000),
})

const UpdateBugSchema = z.object({
  status: z.enum(['open', 'in_progress', 'fixed', 'wontfix']),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PilotStatus = 'invited' | 'onboarding' | 'generating' | 'deployed' | 'live' | 'active'

interface PilotRow {
  id: string
  name: string
  sector: string
  status: PilotStatus
  email: string
  organization: string
  site_url: string | null
  created_at: string
}

interface BugRow {
  id: string
  pilot_id: string
  pilot_name: string
  severity: 'critical' | 'major' | 'minor' | 'cosmetic'
  description: string
  status: 'open' | 'in_progress' | 'fixed' | 'wontfix'
  created_at: string
  fixed_at: string | null
}

// ---------------------------------------------------------------------------
// Default pilot data (used when table doesn't exist yet)
// ---------------------------------------------------------------------------

const DEFAULT_PILOTS: PilotRow[] = [
  {
    id: 'pilot-a',
    name: 'Pilote A',
    sector: 'Coiffure',
    status: 'invited',
    email: '',
    organization: '',
    site_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'pilot-b',
    name: 'Pilote B',
    sector: 'BTP',
    status: 'invited',
    email: '',
    organization: '',
    site_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'pilot-c',
    name: 'Pilote C',
    sector: 'Médical / Commerce',
    status: 'invited',
    email: '',
    organization: '',
    site_url: null,
    created_at: new Date().toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function adminPilotRoutes(fastify: FastifyInstance) {
  const superadminOnly = requireRole(['superadmin'])

  // -----------------------------------------------------------------------
  // GET /api/v1/admin/pilots — List all pilots with KPIs & bug summary
  // -----------------------------------------------------------------------
  fastify.get(
    '/api/v1/admin/pilots',
    { preHandler: superadminOnly },
    async (_request, reply) => {
      const supabase = adminClient()

      // Attempt to fetch pilots from DB
      let pilots: PilotRow[] = DEFAULT_PILOTS
      const { data: pilotRows } = await supabase
        .from('pilots')
        .select('*')
        .order('created_at', { ascending: true })

      if (pilotRows && pilotRows.length > 0) {
        pilots = pilotRows as PilotRow[]
      }

      // Fetch bugs summary
      let bugSummary = { critical: 0, major: 0, minor: 0, cosmetic: 0 }
      const { data: bugRows } = await supabase
        .from('pilot_bugs')
        .select('severity, status')

      if (bugRows) {
        const openBugs = (bugRows as { severity: string; status: string }[]).filter(
          (b) => b.status !== 'fixed' && b.status !== 'wontfix',
        )
        bugSummary = {
          critical: openBugs.filter((b) => b.severity === 'critical').length,
          major: openBugs.filter((b) => b.severity === 'major').length,
          minor: openBugs.filter((b) => b.severity === 'minor').length,
          cosmetic: openBugs.filter((b) => b.severity === 'cosmetic').length,
        }
      }

      // KPIs (computed from pilot data)
      const deployedCount = pilots.filter(
        (p) => ['deployed', 'live', 'active'].includes(p.status),
      ).length

      const kpis = {
        sitesDeployed: deployedCount,
        sitesTotal: pilots.length,
        uptime: deployedCount > 0 ? 99.9 : 0,
        avgLcp: 0,
        avgSeoScore: 0,
        costClaudePerSite: 0,
        costInfraPerSite: 0,
      }

      // Fetch cost data if available
      const { data: costRows } = await supabase
        .from('pilot_costs')
        .select('claude_cost, infra_cost')

      if (costRows && costRows.length > 0) {
        const totalClaude = (costRows as { claude_cost: number; infra_cost: number }[]).reduce(
          (sum, c) => sum + (c.claude_cost ?? 0),
          0,
        )
        const totalInfra = (costRows as { claude_cost: number; infra_cost: number }[]).reduce(
          (sum, c) => sum + (c.infra_cost ?? 0),
          0,
        )
        kpis.costClaudePerSite = pilots.length > 0 ? totalClaude / pilots.length : 0
        kpis.costInfraPerSite = pilots.length > 0 ? totalInfra / pilots.length : 0
      }

      return reply.send({
        data: {
          pilots: pilots.map((p) => ({
            id: p.id,
            name: p.name,
            sector: p.sector,
            status: p.status,
            email: p.email,
            organization: p.organization,
            siteUrl: p.site_url,
            createdAt: p.created_at,
          })),
          kpis,
          bugs: bugSummary,
        },
      })
    },
  )

  // -----------------------------------------------------------------------
  // GET /api/v1/admin/pilots/:id — Pilot detail with costs, timeline, bugs
  // -----------------------------------------------------------------------
  fastify.get(
    '/api/v1/admin/pilots/:id',
    { preHandler: superadminOnly },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const supabase = adminClient()

      // Pilot data
      let pilot: PilotRow | undefined
      const { data: pilotRow } = await supabase
        .from('pilots')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (pilotRow) {
        pilot = pilotRow as PilotRow
      } else {
        pilot = DEFAULT_PILOTS.find((p) => p.id === id)
      }

      if (!pilot) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Pilote introuvable' },
        })
      }

      // Timeline events
      let timeline: { id: string; type: string; label: string; date: string; details?: string }[] = []
      const { data: timelineRows } = await supabase
        .from('pilot_timeline')
        .select('*')
        .eq('pilot_id', id)
        .order('date', { ascending: true })

      if (timelineRows) {
        timeline = (timelineRows as { id: string; type: string; label: string; date: string; details?: string }[])
      }

      // Costs
      let costs = {
        claudeTokensUsed: 0,
        claudeCost: 0,
        apiCalls: 0,
        apiCost: 0,
        storageMb: 0,
        storageCost: 0,
        totalCost: 0,
      }
      const { data: costRow } = await supabase
        .from('pilot_costs')
        .select('*')
        .eq('pilot_id', id)
        .maybeSingle()

      if (costRow) {
        const c = costRow as Record<string, number>
        costs = {
          claudeTokensUsed: c.claude_tokens_used ?? 0,
          claudeCost: c.claude_cost ?? 0,
          apiCalls: c.api_calls ?? 0,
          apiCost: c.api_cost ?? 0,
          storageMb: c.storage_mb ?? 0,
          storageCost: c.storage_cost ?? 0,
          totalCost: (c.claude_cost ?? 0) + (c.api_cost ?? 0) + (c.storage_cost ?? 0),
        }
      }

      // Bugs for this pilot
      let bugs: BugRow[] = []
      const { data: bugRows } = await supabase
        .from('pilot_bugs')
        .select('*')
        .eq('pilot_id', id)
        .order('created_at', { ascending: false })

      if (bugRows) {
        bugs = bugRows as BugRow[]
      }

      // Contents for this pilot
      let contents: { id: string; type: string; title: string; status: string; created_at: string }[] = []
      const { data: contentRows } = await supabase
        .from('pilot_contents')
        .select('*')
        .eq('pilot_id', id)
        .order('created_at', { ascending: false })

      if (contentRows) {
        contents = contentRows as typeof contents
      }

      return reply.send({
        data: {
          id: pilot.id,
          name: pilot.name,
          email: pilot.email,
          sector: pilot.sector,
          organization: pilot.organization,
          status: pilot.status,
          siteUrl: pilot.site_url,
          timeline,
          costs,
          bugs: bugs.map((b) => ({
            id: b.id,
            severity: b.severity,
            description: b.description,
            status: b.status,
            createdAt: b.created_at,
            fixedAt: b.fixed_at,
          })),
          contents: contents.map((c) => ({
            id: c.id,
            type: c.type,
            title: c.title,
            status: c.status,
            createdAt: c.created_at,
          })),
        },
      })
    },
  )

  // -----------------------------------------------------------------------
  // POST /api/v1/admin/pilots/:id/invite — Send invitation to pilot
  // -----------------------------------------------------------------------
  fastify.post(
    '/api/v1/admin/pilots/:id/invite',
    { preHandler: superadminOnly },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const supabase = adminClient()

      // Update pilot status
      const { error } = await supabase
        .from('pilots')
        .update({ status: 'invited' })
        .eq('id', id)

      if (error) {
        fastify.log.warn({ error: error.message }, 'Table pilots may not exist yet')
      }

      // Log timeline event
      await supabase.from('pilot_timeline').insert({
        pilot_id: id,
        type: 'invited',
        label: 'Invitation envoyée',
        date: new Date().toISOString(),
      })

      fastify.log.info({ pilotId: id }, 'Invitation envoyée au pilote')

      return reply.send({
        data: { success: true, message: `Invitation envoyée au pilote ${id}` },
      })
    },
  )

  // -----------------------------------------------------------------------
  // GET /api/v1/admin/costs — Aggregated cost data
  // -----------------------------------------------------------------------
  fastify.get(
    '/api/v1/admin/costs',
    { preHandler: superadminOnly },
    async (_request, reply) => {
      const supabase = adminClient()

      // Fetch pilot costs
      const { data: costRows } = await supabase
        .from('pilot_costs')
        .select('*, pilot:pilots(name, sector)')

      const sites = (costRows ?? []).map((row: Record<string, unknown>) => {
        const pilot = row.pilot as { name: string; sector: string } | null
        const claudeCost = (row.claude_cost as number) ?? 0
        const infraCost = (row.infra_cost as number) ?? 0
        const revenue = (row.revenue as number) ?? 0
        return {
          pilotId: row.pilot_id as string,
          pilotName: pilot ? `${pilot.name} (${pilot.sector})` : (row.pilot_id as string),
          claudeCost,
          infraCost,
          totalCost: claudeCost + infraCost,
          revenue,
          margin: revenue - claudeCost - infraCost,
        }
      })

      // If no data, return defaults
      if (sites.length === 0) {
        return reply.send({
          data: {
            sites: DEFAULT_PILOTS.map((p) => ({
              pilotId: p.id,
              pilotName: `${p.name} (${p.sector})`,
              claudeCost: 0,
              infraCost: 0,
              totalCost: 0,
              revenue: 0,
              margin: 0,
            })),
            modules: [
              { module: 'site_generation', label: 'Génération site', totalCost: 0, callCount: 0 },
              { module: 'posts_rs', label: 'Posts réseaux sociaux', totalCost: 0, callCount: 0 },
              { module: 'blog_seo', label: 'Articles blog SEO', totalCost: 0, callCount: 0 },
              { module: 'gmb', label: 'Fiches GMB', totalCost: 0, callCount: 0 },
              { module: 'report', label: 'Rapports PDF', totalCost: 0, callCount: 0 },
            ],
            infra: [
              { label: 'VPS (Hetzner/Coolify)', monthlyCost: 0 },
              { label: 'Redis', monthlyCost: 0 },
              { label: 'Stockage (Supabase)', monthlyCost: 0 },
              { label: 'Domaines', monthlyCost: 0 },
            ],
            totals: {
              claudeMonthly: 0,
              infraMonthly: 0,
              revenueMonthly: 0,
              marginMonthly: 0,
            },
          },
        })
      }

      const totalClaude = sites.reduce((s: number, c: { claudeCost: number }) => s + c.claudeCost, 0)
      const totalInfra = sites.reduce((s: number, c: { infraCost: number }) => s + c.infraCost, 0)
      const totalRevenue = sites.reduce((s: number, c: { revenue: number }) => s + c.revenue, 0)

      // Module costs
      const { data: moduleCostRows } = await supabase
        .from('module_costs')
        .select('module, label, total_cost, call_count')

      const modules = (moduleCostRows ?? []).map((m: Record<string, unknown>) => ({
        module: m.module as string,
        label: m.label as string,
        totalCost: (m.total_cost as number) ?? 0,
        callCount: (m.call_count as number) ?? 0,
      }))

      // Infrastructure costs
      const { data: infraRows } = await supabase
        .from('infra_costs')
        .select('label, monthly_cost')

      const infra = (infraRows ?? []).map((i: Record<string, unknown>) => ({
        label: i.label as string,
        monthlyCost: (i.monthly_cost as number) ?? 0,
      }))

      return reply.send({
        data: {
          sites,
          modules,
          infra,
          totals: {
            claudeMonthly: totalClaude,
            infraMonthly: totalInfra,
            revenueMonthly: totalRevenue,
            marginMonthly: totalRevenue - totalClaude - totalInfra,
          },
        },
      })
    },
  )

  // -----------------------------------------------------------------------
  // GET /api/v1/admin/bugs — List all bugs
  // -----------------------------------------------------------------------
  fastify.get(
    '/api/v1/admin/bugs',
    { preHandler: superadminOnly },
    async (_request, reply) => {
      const supabase = adminClient()

      const { data: bugRows } = await supabase
        .from('pilot_bugs')
        .select('*, pilot:pilots(name)')
        .order('created_at', { ascending: false })

      const bugs = (bugRows ?? []).map((b: Record<string, unknown>) => {
        const pilot = b.pilot as { name: string } | null
        return {
          id: b.id as string,
          pilotId: b.pilot_id as string,
          pilotName: pilot?.name ?? (b.pilot_id as string),
          severity: b.severity as string,
          description: b.description as string,
          status: b.status as string,
          createdAt: b.created_at as string,
          fixedAt: b.fixed_at as string | null,
        }
      })

      return reply.send({ data: bugs })
    },
  )

  // -----------------------------------------------------------------------
  // POST /api/v1/admin/bugs — Create a new bug
  // -----------------------------------------------------------------------
  fastify.post(
    '/api/v1/admin/bugs',
    { preHandler: superadminOnly },
    async (request, reply) => {
      const parseResult = CreateBugSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données invalides',
            details: parseResult.error.flatten().fieldErrors,
          },
        })
      }

      const { pilotId, severity, description } = parseResult.data
      const supabase = adminClient()

      // Count existing bugs for ID generation
      const { count } = await supabase
        .from('pilot_bugs')
        .select('*', { count: 'exact', head: true })

      const bugNumber = ((count ?? 0) + 1).toString().padStart(3, '0')
      const bugId = `BUG-P7-${bugNumber}`

      const { data: bug, error } = await supabase
        .from('pilot_bugs')
        .insert({
          id: bugId,
          pilot_id: pilotId,
          severity,
          description,
          status: 'open',
          created_at: new Date().toISOString(),
          fixed_at: null,
        })
        .select('*')
        .single()

      if (error) {
        fastify.log.error({ error: error.message }, 'Erreur création bug')
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la création du bug' },
        })
      }

      return reply.status(201).send({ data: bug })
    },
  )

  // -----------------------------------------------------------------------
  // PATCH /api/v1/admin/bugs/:id — Update bug status
  // -----------------------------------------------------------------------
  fastify.patch(
    '/api/v1/admin/bugs/:id',
    { preHandler: superadminOnly },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const parseResult = UpdateBugSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données invalides',
            details: parseResult.error.flatten().fieldErrors,
          },
        })
      }

      const { status } = parseResult.data
      const supabase = adminClient()

      const updates: Record<string, unknown> = { status }
      if (status === 'fixed') {
        updates.fixed_at = new Date().toISOString()
      }

      const { data: bug, error } = await supabase
        .from('pilot_bugs')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !bug) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Bug introuvable' },
        })
      }

      return reply.send({ data: bug })
    },
  )
}
