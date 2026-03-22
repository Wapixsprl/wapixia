'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '../../../lib/supabase'

interface Site {
  id: string
  name: string
  temp_domain: string | null
  custom_domain: string | null
  status: string
  sector: string | null
  onboarding_done: boolean
  visibility_score: number | null
  organization_id: string | null
  owner_user_id: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  setup: { label: 'En configuration', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  staging: { label: 'En test', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  live: { label: 'En ligne', color: 'bg-green-50 text-green-700 border-green-200' },
  suspended: { label: 'Suspendu', color: 'bg-red-50 text-red-700 border-red-200' },
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSites() {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Get user role & org
      const { data: userData } = await supabase
        .from('users')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()

      let query = supabase
        .from('sites')
        .select('id, name, temp_domain, custom_domain, status, sector, onboarding_done, visibility_score, organization_id, owner_user_id, created_at')
        .order('created_at', { ascending: false })

      // Non-superadmin: filter by their org
      if (userData?.role !== 'superadmin' && userData?.organization_id) {
        query = query.eq('organization_id', userData.organization_id)
      }

      const { data } = await query
      if (data) setSites(data)
      setLoading(false)
    }
    void loadSites()
  }, [])

  const filtered = sites.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez tous vos sites depuis un seul endroit.
          </p>
        </div>
        <a
          href="/onboarding"
          className="inline-flex items-center gap-2 rounded-lg bg-[#F5A623] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#E09600]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Creer un site
        </a>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20"
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
          <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <p className="text-sm text-gray-400">
            {search ? 'Aucun site ne correspond a votre recherche.' : 'Aucun site pour le moment.'}
          </p>
          {!search && (
            <a
              href="/onboarding"
              className="mt-3 text-sm font-medium text-[#F5A623] hover:underline"
            >
              Creer votre premier site
            </a>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((site) => {
            const status = STATUS_LABELS[site.status] ?? { label: 'En configuration', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
            return (
              <a
                key={site.id}
                href={`/sites/${site.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-[#F5A623]/30"
              >
                {/* Header row */}
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#F5A623] transition-colors line-clamp-1">
                    {site.name}
                  </h3>
                  <span className={`shrink-0 ml-2 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {/* Domain */}
                {(site.custom_domain || site.temp_domain) && (
                  <p className="mb-3 text-xs text-gray-500 truncate">{site.custom_domain || site.temp_domain}</p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  {site.sector && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{site.sector}</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 ${site.onboarding_done ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                    {site.onboarding_done ? 'Onboarding OK' : 'Onboarding en cours'}
                  </span>
                </div>

                {/* Visibility score */}
                {site.visibility_score != null && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#F5A623] transition-all"
                        style={{ width: `${Math.min(100, site.visibility_score)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600">{site.visibility_score}%</span>
                  </div>
                )}

                {/* Date */}
                <p className="mt-3 text-xs text-gray-400">
                  Cree le {new Date(site.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
