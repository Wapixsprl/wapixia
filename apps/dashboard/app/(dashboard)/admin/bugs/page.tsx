'use client'

import { useState } from 'react'

const MOCK_BUGS = [
  { id: 1, title: 'Image hero ne charge pas sur mobile Safari', severity: 'high', site: 'Boulangerie Martin', status: 'open', date: '2026-03-18' },
  { id: 2, title: 'Formulaire contact - email non envoye', severity: 'critical', site: 'Pizza Napoli', status: 'open', date: '2026-03-19' },
  { id: 3, title: 'Horaires affichent mauvais fuseau', severity: 'medium', site: 'Dr. Dupont', status: 'in_progress', date: '2026-03-17' },
  { id: 4, title: 'Lenteur chargement page services', severity: 'low', site: 'Salon Beaute Liege', status: 'resolved', date: '2026-03-15' },
  { id: 5, title: 'Texte AI contient des hallucinations', severity: 'high', site: 'Immo Bruxelles', status: 'in_progress', date: '2026-03-19' },
  { id: 6, title: 'Schema.org manquant sur page FAQ', severity: 'medium', site: 'Boulangerie Martin', status: 'resolved', date: '2026-03-14' },
  { id: 7, title: 'Google My Business sync echoue', severity: 'high', site: 'Pizza Napoli', status: 'open', date: '2026-03-20' },
]

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-50 text-red-700',
  in_progress: 'bg-blue-50 text-blue-700',
  resolved: 'bg-green-50 text-green-700',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Resolu',
}

export default function BugsPage() {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? MOCK_BUGS : MOCK_BUGS.filter((b) => b.status === filter)
  const openCount = MOCK_BUGS.filter((b) => b.status === 'open').length
  const criticalCount = MOCK_BUGS.filter((b) => b.severity === 'critical' && b.status !== 'resolved').length
  const resolvedCount = MOCK_BUGS.filter((b) => b.status === 'resolved').length

  const goLiveReady = criticalCount === 0 && openCount <= 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bugs & QA</h1>
          <p className="mt-1 text-sm text-gray-500">Suivi qualite et readiness Go-Live</p>
        </div>
        <div className={`rounded-lg px-4 py-2 text-sm font-semibold ${goLiveReady ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {goLiveReady ? '✅ Go-Live Ready' : '🚫 Go-Live Bloque'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-gray-500">Total Bugs</span>
          <p className="mt-2 text-2xl font-bold text-gray-900">{MOCK_BUGS.length}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <span className="text-sm text-red-600">Ouverts</span>
          <p className="mt-2 text-2xl font-bold text-red-700">{openCount}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
          <span className="text-sm text-orange-600">Critiques</span>
          <p className="mt-2 text-2xl font-bold text-orange-700">{criticalCount}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <span className="text-sm text-green-600">Resolus</span>
          <p className="mt-2 text-2xl font-bold text-green-700">{resolvedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'open', 'in_progress', 'resolved'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Tous' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Bug List */}
      <div className="space-y-3">
        {filtered.map((bug) => (
          <div key={bug.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[bug.severity]}`}>
              {bug.severity}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{bug.title}</p>
              <p className="text-xs text-gray-500">{bug.site} &middot; {bug.date}</p>
            </div>
            <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[bug.status]}`}>
              {STATUS_LABELS[bug.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
