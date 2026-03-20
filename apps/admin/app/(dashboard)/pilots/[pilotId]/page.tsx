'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '../../../../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PilotStatus = 'invited' | 'onboarding' | 'generating' | 'deployed' | 'live' | 'active'

interface TimelineEvent {
  id: string
  type: string
  label: string
  date: string
  details?: string
}

interface CostBreakdown {
  claudeTokensUsed: number
  claudeCost: number
  apiCalls: number
  apiCost: number
  storageMb: number
  storageCost: number
  totalCost: number
}

interface Bug {
  id: string
  severity: 'critical' | 'major' | 'minor' | 'cosmetic'
  description: string
  status: 'open' | 'in_progress' | 'fixed' | 'wontfix'
  createdAt: string
  fixedAt: string | null
}

interface Content {
  id: string
  type: 'post_rs' | 'article_blog' | 'fiche_gmb'
  title: string
  status: 'draft' | 'pending_validation' | 'validated' | 'published'
  createdAt: string
}

interface PilotDetail {
  id: string
  name: string
  email: string
  sector: string
  organization: string
  status: PilotStatus
  siteUrl: string | null
  timeline: TimelineEvent[]
  costs: CostBreakdown
  bugs: Bug[]
  contents: Content[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const SEVERITY_BADGE: Record<Bug['severity'], string> = {
  critical: 'bg-red-100 text-red-800',
  major: 'bg-orange-100 text-orange-800',
  minor: 'bg-yellow-100 text-yellow-800',
  cosmetic: 'bg-gray-100 text-gray-600',
}

const CONTENT_STATUS_LABEL: Record<Content['status'], string> = {
  draft: 'Brouillon',
  pending_validation: 'En attente',
  validated: 'Valid\u00e9',
  published: 'Publi\u00e9',
}

const CONTENT_TYPE_LABEL: Record<Content['type'], string> = {
  post_rs: 'Post RS',
  article_blog: 'Article Blog',
  fiche_gmb: 'Fiche GMB',
}

const TIMELINE_ICONS: Record<string, string> = {
  invited: '\u2709\ufe0f',
  onboarded: '\u2705',
  generated: '\u2699\ufe0f',
  deployed: '\u{1f680}',
  domain_connected: '\u{1f310}',
  modules_activated: '\u{1f9e9}',
}

// ---------------------------------------------------------------------------
// Default placeholder
// ---------------------------------------------------------------------------

function defaultPilot(id: string): PilotDetail {
  return {
    id,
    name: id === 'pilot-a' ? 'Pilote A' : id === 'pilot-b' ? 'Pilote B' : 'Pilote C',
    email: '',
    sector: id === 'pilot-a' ? 'Coiffure' : id === 'pilot-b' ? 'BTP' : 'M\u00e9dical / Commerce',
    organization: '',
    status: 'invited',
    siteUrl: null,
    timeline: [],
    costs: {
      claudeTokensUsed: 0,
      claudeCost: 0,
      apiCalls: 0,
      apiCost: 0,
      storageMb: 0,
      storageCost: 0,
      totalCost: 0,
    },
    bugs: [],
    contents: [],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PilotDetailPage() {
  const params = useParams()
  const pilotId = params.pilotId as string

  const [pilot, setPilot] = useState<PilotDetail>(defaultPilot(pilotId))
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const data = await apiClient<{ data: PilotDetail }>(
        `/api/v1/admin/pilots/${pilotId}`,
      )
      setPilot(data.data)
    } catch {
      // API not ready, keep defaults
    } finally {
      setLoading(false)
    }
  }, [pilotId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleAction(action: string) {
    setActionLoading(action)
    try {
      if (action === 'invite') {
        await apiClient(`/api/v1/admin/pilots/${pilotId}/invite`, { method: 'POST' })
      }
      await loadData()
    } catch {
      // silently handle
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D4B1]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/pilots" className="hover:text-[#00D4B1]">
          Pilotes
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{pilot.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{pilot.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[pilot.status]}`}
            >
              {STATUS_LABELS[pilot.status]}
            </span>
          </div>
          {pilot.email && (
            <p className="mt-1 text-sm text-gray-500">{pilot.email}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleAction('domain')}
            disabled={actionLoading === 'domain'}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Connecter domaine
          </button>
          <button
            type="button"
            onClick={() => void handleAction('modules')}
            disabled={actionLoading === 'modules'}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Activer modules
          </button>
          <button
            type="button"
            onClick={() => void handleAction('report')}
            disabled={actionLoading === 'report'}
            className="rounded-lg border border-[#00D4B1] bg-[#00D4B1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#00b89a] disabled:opacity-50"
          >
            G\u00e9n\u00e9rer rapport PDF
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pilot Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Informations
          </h2>
          <dl className="mt-4 space-y-3">
            <InfoRow label="Nom" value={pilot.name} />
            <InfoRow label="Email" value={pilot.email || '—'} />
            <InfoRow label="Secteur" value={pilot.sector} />
            <InfoRow label="Organisation" value={pilot.organization || '—'} />
            {pilot.siteUrl && (
              <InfoRow
                label="Site"
                value={
                  <a
                    href={pilot.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00D4B1] hover:underline"
                  >
                    {pilot.siteUrl}
                  </a>
                }
              />
            )}
          </dl>
        </div>

        {/* Cost Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Co\u00fbts
          </h2>
          <dl className="mt-4 space-y-3">
            <InfoRow
              label="Tokens Claude"
              value={pilot.costs.claudeTokensUsed.toLocaleString('fr-FR')}
            />
            <InfoRow label="Co\u00fbt Claude" value={`${pilot.costs.claudeCost.toFixed(2)} \u20ac`} />
            <InfoRow label="Appels API" value={pilot.costs.apiCalls.toLocaleString('fr-FR')} />
            <InfoRow label="Co\u00fbt API" value={`${pilot.costs.apiCost.toFixed(2)} \u20ac`} />
            <InfoRow label="Stockage" value={`${pilot.costs.storageMb.toFixed(1)} Mo`} />
            <InfoRow label="Co\u00fbt stockage" value={`${pilot.costs.storageCost.toFixed(2)} \u20ac`} />
            <div className="border-t border-gray-200 pt-3">
              <InfoRow
                label="Total"
                value={
                  <span className="text-lg font-bold text-gray-900">
                    {pilot.costs.totalCost.toFixed(2)} \u20ac
                  </span>
                }
              />
            </div>
          </dl>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Chronologie
          </h2>
          {pilot.timeline.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">Aucun \u00e9v\u00e9nement enregistr\u00e9</p>
          ) : (
            <ol className="relative mt-4 border-l border-gray-200">
              {pilot.timeline.map((event) => (
                <li key={event.id} className="mb-6 ml-6 last:mb-0">
                  <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white">
                    <span className="text-sm">
                      {TIMELINE_ICONS[event.type] ?? '\u{1f4cc}'}
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {event.label}
                    </p>
                    <time className="text-xs text-gray-500">
                      {new Date(event.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    {event.details && (
                      <p className="mt-1 text-xs text-gray-400">{event.details}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Bugs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Bugs ({pilot.bugs.length})
          </h2>
        </div>
        {pilot.bugs.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            Aucun bug signal\u00e9 pour ce pilote
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    S\u00e9v\u00e9rit\u00e9
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {pilot.bugs.map((bug) => (
                  <tr key={bug.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[bug.severity]}`}
                      >
                        {bug.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {bug.description}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {bug.status}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(bug.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generated Contents */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Contenus g\u00e9n\u00e9r\u00e9s ({pilot.contents.length})
          </h2>
        </div>
        {pilot.contents.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            Aucun contenu g\u00e9n\u00e9r\u00e9 pour ce pilote
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Titre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {pilot.contents.map((content) => (
                  <tr key={content.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {CONTENT_TYPE_LABEL[content.type]}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {content.title}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {CONTENT_STATUS_LABEL[content.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(content.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}
