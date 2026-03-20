'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '../../../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'critical' | 'major' | 'minor' | 'cosmetic'
type BugStatus = 'open' | 'in_progress' | 'fixed' | 'wontfix'

interface Bug {
  id: string
  pilotId: string
  pilotName: string
  severity: Severity
  description: string
  status: BugStatus
  createdAt: string
  fixedAt: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'critical', label: 'Critique' },
  { value: 'major', label: 'Majeur' },
  { value: 'minor', label: 'Mineur' },
  { value: 'cosmetic', label: 'Cosm\u00e9tique' },
]

const STATUS_OPTIONS: { value: BugStatus; label: string }[] = [
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'fixed', label: 'Corrig\u00e9' },
  { value: 'wontfix', label: 'Won\'t fix' },
]

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  major: 'bg-orange-100 text-orange-800 border-orange-200',
  minor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cosmetic: 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_BADGE: Record<BugStatus, string> = {
  open: 'bg-red-50 text-red-700',
  in_progress: 'bg-yellow-50 text-yellow-700',
  fixed: 'bg-emerald-50 text-emerald-700',
  wontfix: 'bg-gray-50 text-gray-500',
}

const PILOT_OPTIONS = [
  { value: 'pilot-a', label: 'Pilote A (Coiffure)' },
  { value: 'pilot-b', label: 'Pilote B (BTP)' },
  { value: 'pilot-c', label: 'Pilote C (M\u00e9dical)' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BugsPage() {
  const [bugs, setBugs] = useState<Bug[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<BugStatus | 'all'>('all')
  const [filterPilot, setFilterPilot] = useState<string>('all')

  // Inline add form
  const [showForm, setShowForm] = useState(false)
  const [newBug, setNewBug] = useState({
    pilotId: 'pilot-a',
    severity: 'minor' as Severity,
    description: '',
  })

  const loadData = useCallback(async () => {
    try {
      const res = await apiClient<{ data: Bug[] }>('/api/v1/admin/bugs')
      setBugs(res.data)
    } catch {
      // API not ready
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Go/No-Go calculation
  const criticalCount = bugs.filter((b) => b.severity === 'critical' && b.status !== 'fixed' && b.status !== 'wontfix').length
  const majorCount = bugs.filter((b) => b.severity === 'major' && b.status !== 'fixed' && b.status !== 'wontfix').length
  const isGoReady = criticalCount === 0 && majorCount === 0

  // Filtered bugs
  const filteredBugs = bugs.filter((b) => {
    if (filterSeverity !== 'all' && b.severity !== filterSeverity) return false
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    if (filterPilot !== 'all' && b.pilotId !== filterPilot) return false
    return true
  })

  async function handleAddBug() {
    if (!newBug.description.trim()) return
    setSaving(true)
    try {
      await apiClient('/api/v1/admin/bugs', {
        method: 'POST',
        body: JSON.stringify(newBug),
      })
      await loadData()
      setNewBug({ pilotId: 'pilot-a', severity: 'minor', description: '' })
      setShowForm(false)
    } catch {
      // Add locally as fallback
      const localBug: Bug = {
        id: `BUG-P7-${String(bugs.length + 1).padStart(3, '0')}`,
        pilotId: newBug.pilotId,
        pilotName: PILOT_OPTIONS.find((p) => p.value === newBug.pilotId)?.label ?? newBug.pilotId,
        severity: newBug.severity,
        description: newBug.description,
        status: 'open',
        createdAt: new Date().toISOString(),
        fixedAt: null,
      }
      setBugs((prev) => [localBug, ...prev])
      setNewBug({ pilotId: 'pilot-a', severity: 'minor', description: '' })
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(bugId: string, newStatus: BugStatus) {
    try {
      await apiClient(`/api/v1/admin/bugs/${bugId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      await loadData()
    } catch {
      // Update locally as fallback
      setBugs((prev) =>
        prev.map((b) =>
          b.id === bugId
            ? {
                ...b,
                status: newStatus,
                fixedAt: newStatus === 'fixed' ? new Date().toISOString() : b.fixedAt,
              }
            : b,
        ),
      )
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suivi des bugs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sprint 7 — Bugs pilotes Go/No-Go
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[#00D4B1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#00b89a]"
        >
          {showForm ? 'Annuler' : '+ Signaler un bug'}
        </button>
      </div>

      {/* Go / No-Go Indicator */}
      <div
        className={`rounded-xl border-2 p-6 ${
          isGoReady
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-red-300 bg-red-50'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${
              isGoReady ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          >
            {isGoReady ? 'GO' : 'NO'}
          </div>
          <div>
            <h2 className={`text-lg font-bold ${isGoReady ? 'text-emerald-800' : 'text-red-800'}`}>
              {isGoReady ? 'Go-Live pr\u00eat' : 'Go-Live bloqu\u00e9'}
            </h2>
            <p className={`text-sm ${isGoReady ? 'text-emerald-600' : 'text-red-600'}`}>
              {isGoReady
                ? 'Aucun bug critique ou majeur ouvert. Le Go-Live est possible.'
                : `${criticalCount} critique(s) et ${majorCount} majeur(s) ouverts. Crit\u00e8res : 0 critique, 0 majeur.`}
            </p>
          </div>
        </div>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <div className="rounded-xl border border-[#00D4B1]/30 bg-[#00D4B1]/5 p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Nouveau bug
          </h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="bug-pilot" className="mb-1 block text-xs font-medium text-gray-600">
                Pilote
              </label>
              <select
                id="bug-pilot"
                value={newBug.pilotId}
                onChange={(e) => setNewBug({ ...newBug, pilotId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00D4B1] focus:outline-none focus:ring-1 focus:ring-[#00D4B1]"
              >
                {PILOT_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bug-severity" className="mb-1 block text-xs font-medium text-gray-600">
                S\u00e9v\u00e9rit\u00e9
              </label>
              <select
                id="bug-severity"
                value={newBug.severity}
                onChange={(e) => setNewBug({ ...newBug, severity: e.target.value as Severity })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00D4B1] focus:outline-none focus:ring-1 focus:ring-[#00D4B1]"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bug-description" className="mb-1 block text-xs font-medium text-gray-600">
                Description
              </label>
              <div className="flex gap-2">
                <input
                  id="bug-description"
                  type="text"
                  value={newBug.description}
                  onChange={(e) => setNewBug({ ...newBug, description: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleAddBug()
                  }}
                  placeholder="D\u00e9crivez le bug..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00D4B1] focus:outline-none focus:ring-1 focus:ring-[#00D4B1]"
                />
                <button
                  type="button"
                  onClick={() => void handleAddBug()}
                  disabled={saving || !newBug.description.trim()}
                  className="rounded-lg bg-[#00D4B1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#00b89a] disabled:opacity-50"
                >
                  {saving ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-500">Filtrer :</span>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as Severity | 'all')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#00D4B1] focus:outline-none"
        >
          <option value="all">Toutes s\u00e9v\u00e9rit\u00e9s</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as BugStatus | 'all')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#00D4B1] focus:outline-none"
        >
          <option value="all">Tous statuts</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterPilot}
          onChange={(e) => setFilterPilot(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#00D4B1] focus:outline-none"
        >
          <option value="all">Tous pilotes</option>
          {PILOT_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {(filterSeverity !== 'all' || filterStatus !== 'all' || filterPilot !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setFilterSeverity('all')
              setFilterStatus('all')
              setFilterPilot('all')
            }}
            className="text-sm text-[#00D4B1] hover:underline"
          >
            R\u00e9initialiser
          </button>
        )}
      </div>

      {/* Bug Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {filteredBugs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">
            Aucun bug trouv\u00e9 avec ces filtres
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Pilote
                  </th>
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
                    Date fix
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredBugs.map((bug) => (
                  <tr key={bug.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-500">
                      {bug.id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {bug.pilotName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[bug.severity]}`}
                      >
                        {SEVERITY_OPTIONS.find((s) => s.value === bug.severity)?.label}
                      </span>
                    </td>
                    <td className="max-w-md px-6 py-4 text-sm text-gray-900">
                      {bug.description}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <select
                        value={bug.status}
                        onChange={(e) => void handleStatusChange(bug.id, e.target.value as BugStatus)}
                        className={`rounded-full border-0 px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00D4B1] ${STATUS_BADGE[bug.status]}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {bug.fixedAt
                        ? new Date(bug.fixedAt).toLocaleDateString('fr-FR')
                        : '—'}
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
