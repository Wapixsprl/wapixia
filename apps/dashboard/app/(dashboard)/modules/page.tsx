'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../../../lib/api'
import { createBrowserClient } from '../../../lib/supabase'
import ModuleCard from './components/ModuleCard'
import type { ModuleItem } from './components/ModuleCard'

interface ModulesResponse {
  data: ModuleItem[]
}

export default function ModulesPage() {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Resolve siteId
  useEffect(() => {
    async function resolveSite() {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .eq('owner_id', user.id)
        .single()
      if (site?.id) setSiteId(site.id)
    }
    void resolveSite()
  }, [])

  const fetchModules = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient<ModulesResponse>(
        `/api/v1/sites/${siteId}/modules`,
      )
      setModules(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    void fetchModules()
  }, [fetchModules])

  async function handleToggle(moduleId: string, active: boolean) {
    if (!siteId) return
    await apiClient(`/api/v1/sites/${siteId}/modules/${moduleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: active }),
    })
    await fetchModules()
  }

  // Stats
  const activeCount = modules.filter((m) => m.is_active).length
  const totalMonthly = modules
    .filter((m) => m.is_active)
    .reduce((sum, m) => sum + m.price_monthly, 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Activez et configurez les modules IA pour votre site.
          </p>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4 rounded-xl bg-white px-5 py-3 shadow-sm">
          <div className="text-center">
            <p className="text-lg font-bold text-[#00D4B1]">{activeCount}</p>
            <p className="text-xs text-gray-400">Actifs</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{totalMonthly}&euro;</p>
            <p className="text-xs text-gray-400">/mois</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D4B1]" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              siteId={siteId ?? ''}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
