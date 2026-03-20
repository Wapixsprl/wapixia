'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { apiClient } from '../../../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PilotStatus = 'invited' | 'onboarding' | 'generating' | 'deployed' | 'live' | 'active'

interface Pilot {
  id: string
  name: string
  sector: string
  status: PilotStatus
  email: string
  organization: string
  siteUrl: string | null
  createdAt: string
}

interface BugSummary {
  critical: number
  major: number
  minor: number
  cosmetic: number
}

interface PilotKpis {
  sitesDeployed: number
  sitesTotal: number
  uptime: number
  avgLcp: number
  avgSeoScore: number
  costClaudePerSite: number
  costInfraPerSite: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_PIPELINE: PilotStatus[] = ['invited', 'onboarding', 'generating', 'deployed', 'live', 'active']

const STATUS_LABELS: Record<PilotStatus, string> = {
  invited: 'Invit\u00e9',
  onboarding: 'Onboarding',
  generating: 'G\u00e9n\u00e9ration',
  deployed: 'D\u00e9ploy\u00e9',
  live: 'En ligne',
  active: 'Actif',
}

const STATUS_COLORS: Record<PilotStatus, string> = {
  invited: 'bg-gray-200 text-gray-700',
  onboarding: 'bg-yellow-100 text-yellow-800',
  generating: 'bg-yellow-200 text-yellow-900',
  deployed: 'bg-emerald-100 text-emerald-800',
  live: 'bg-emerald-200 text-emerald-900',
  active: 'bg-[#00D4B1]/20 text-[#00997f]',
}

const DEFAULT_PILOTS: Pilot[] = [
  {
    id: 'pilot-a',
    name: 'Pilote A',
    sector: 'Coiffure',
    status: 'invited',
    email: '',
    organization: '',
    siteUrl: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pilot-b',
    name: 'Pilote B',
    sector: 'BTP',
    status: 'invited',
    email: '',
    organization: '',
    siteUrl: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pilot-c',
    name: 'Pilote C',
    sector: 'M\u00e9dical / Commerce',
    status: 'invited',
    email: '',
    organization: '',
    siteUrl: null,
    createdAt: new Date().toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PilotsPage() {
  const [pilots, setPilots] = useState<Pilot[]>(DEFAULT_PILOTS)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [kpis, setKpis] = useState<PilotKpis>({
    sitesDeployed: 0,
    sitesTotal: 3,
    uptime: 0,
    avgLcp: 0,
    avgSeoScore: 0,
    costClaudePerSite: 0,
    costInfraPerSite: 0,
  })
  const [bugs, setBugs] = useState<BugSummary>({ critical: 0, major: 0, minor: 0, cosmetic: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const data = await apiClient<{
        data: {
          pilots: Pilot[]
          kpis: PilotKpis
          bugs: BugSummary
        }
      }>('/api/v1/admin/pilots')
      setPilots(data.data.pilots.length > 0 ? data.data.pilots : DEFAULT_PILOTS)
      setKpis(data.data.kpis)
      setBugs(data.data.bugs)
    } catch {
      // API not ready yet, use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function startEditing(pilot: Pilot) {
    setEditingName(pilot.id)
    setNameValue(pilot.name)
  }

  function saveName(pilotId: string) {
    setPilots((prev) =>
      prev.map((p) => (p.id === pilotId ? { ...p, name: nameValue } : p)),
    )
    setEditingName(null)
  }

  async function handleAction(pilotId: string, action: 'invite' | 'onboard' | 'report') {
    setActionLoading(`${pilotId}-${action}`)
    try {
      if (action === 'invite') {
        await apiClient(`/api/v1/admin/pilots/${pilotId}/invite`, { method: 'POST' })
      }
      await loadData()
    } catch {
      // silently handle for now
    } finally {
      setActionLoading(null)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D4B1]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestion des pilotes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sprint 7 — Onboarding de 3 clients pilotes
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Sites d\u00e9ploy\u00e9s" value={`${kpis.sitesDeployed}/${kpis.sitesTotal}`} />
        <KpiCard label="Uptime" value={kpis.uptime > 0 ? `${kpis.uptime.toFixed(1)}%` : '—'} />
        <KpiCard label="LCP moyen" value={kpis.avgLcp > 0 ? `${kpis.avgLcp.toFixed(1)}s` : '—'} />
        <KpiCard label="Score SEO moy." value={kpis.avgSeoScore > 0 ? `${kpis.avgSeoScore}/100` : '—'} />
        <KpiCard
          label="Co\u00fbt Claude/site"
          value={kpis.costClaudePerSite > 0 ? `${kpis.costClaudePerSite.toFixed(2)}\u20ac` : '—'}
          alert={kpis.costClaudePerSite > 4}
        />
        <KpiCard
          label="Co\u00fbt infra/site"
          value={kpis.costInfraPerSite > 0 ? `${kpis.costInfraPerSite.toFixed(2)}\u20ac` : '—'}
        />
        <KpiCard
          label="Bugs"
          value={
            <span className="flex items-center gap-1.5 text-sm">
              <span className="font-bold text-red-600">{bugs.critical}C</span>
              <span className="font-bold text-orange-500">{bugs.major}M</span>
              <span className="text-yellow-600">{bugs.minor}m</span>
              <span className="text-gray-400">{bugs.cosmetic}c</span>
            </span>
          }
        />
      </div>

      {/* Pilot Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {pilots.map((pilot) => (
          <div
            key={pilot.id}
            className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Card Header */}
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {editingName === pilot.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveName(pilot.id)
                          if (e.key === 'Escape') setEditingName(null)
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-lg font-semibold text-gray-900 focus:border-[#00D4B1] focus:outline-none focus:ring-1 focus:ring-[#00D4B1]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => saveName(pilot.id)}
                        className="rounded bg-[#00D4B1] px-2 py-1 text-xs font-medium text-white hover:bg-[#00b89a]"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditing(pilot)}
                      className="group flex items-center gap-2 text-left"
                    >
                      <h3 className="text-lg font-semibold text-gray-900">
                        {pilot.name}
                      </h3>
                      <svg
                        className="h-4 w-4 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                  )}
                  <p className="mt-0.5 text-sm text-gray-500">{pilot.sector}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[pilot.status]}`}
                >
                  {STATUS_LABELS[pilot.status]}
                </span>
              </div>
            </div>

            {/* Status Pipeline */}
            <div className="px-6 py-3">
              <div className="flex items-center gap-1">
                {STATUS_PIPELINE.map((step) => {
                  const currentIndex = STATUS_PIPELINE.indexOf(pilot.status)
                  const stepIndex = STATUS_PIPELINE.indexOf(step)
                  const isCompleted = stepIndex < currentIndex
                  const isCurrent = step === pilot.status

                  return (
                    <div key={step} className="flex flex-1 flex-col items-center">
                      <div
                        className={`h-2 w-full rounded-full ${
                          isCompleted
                            ? 'bg-[#00D4B1]'
                            : isCurrent
                              ? 'bg-yellow-400'
                              : 'bg-gray-200'
                        }`}
                      />
                      <span className="mt-1 text-[10px] text-gray-400">
                        {STATUS_LABELS[step]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => void handleAction(pilot.id, 'invite')}
                disabled={actionLoading === `${pilot.id}-invite`}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {actionLoading === `${pilot.id}-invite` ? 'Envoi...' : 'Envoyer invitation'}
              </button>
              <button
                type="button"
                onClick={() => void handleAction(pilot.id, 'onboard')}
                disabled={actionLoading === `${pilot.id}-onboard`}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Lancer onboarding
              </button>
              <Link
                href={pilot.siteUrl ?? '#'}
                target="_blank"
                className={`rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 ${
                  !pilot.siteUrl ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                Voir le site
              </Link>
              <button
                type="button"
                onClick={() => void handleAction(pilot.id, 'report')}
                disabled={actionLoading === `${pilot.id}-report`}
                className="rounded-lg border border-[#00D4B1] px-3 py-2 text-xs font-medium text-[#00D4B1] transition-colors hover:bg-[#00D4B1]/5 disabled:opacity-50"
              >
                G\u00e9n\u00e9rer rapport
              </button>
            </div>

            {/* Link to detail */}
            <div className="border-t border-gray-100 px-6 py-3">
              <Link
                href={`/pilots/${pilot.id}`}
                className="text-sm font-medium text-[#00D4B1] hover:underline"
              >
                Voir d\u00e9tails &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Bug Tracker Summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">R\u00e9sum\u00e9 des bugs</h2>
          <Link
            href="/bugs"
            className="text-sm font-medium text-[#00D4B1] hover:underline"
          >
            Voir tous les bugs &rarr;
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <BugCounter label="Critiques" count={bugs.critical} color="bg-red-500" />
          <BugCounter label="Majeurs" count={bugs.major} color="bg-orange-500" />
          <BugCounter label="Mineurs" count={bugs.minor} color="bg-yellow-500" />
          <BugCounter label="Cosm\u00e9tiques" count={bugs.cosmetic} color="bg-gray-400" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  alert = false,
}: {
  label: string
  value: React.ReactNode
  alert?: boolean
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        alert ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'
      }`}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}

function BugCounter({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
      <div className={`h-3 w-3 rounded-full ${color}`} />
      <div>
        <p className="text-2xl font-bold text-gray-900">{count}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}
