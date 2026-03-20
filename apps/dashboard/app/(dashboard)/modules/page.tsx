'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '../../../lib/supabase'

interface ModuleCatalog {
  id: string
  name: string
  description: string
  price_monthly: number
  category: string
  is_active: boolean
  sort_order: number
}

interface SiteModule {
  id: string
  module_id: string
  status: string
  activated_at: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  content: 'Contenu',
  reputation: 'Reputation',
  acquisition: 'Acquisition',
  conversion: 'Conversion',
  analytics: 'Analytics',
  technical: 'Technique',
}

const CATEGORY_COLORS: Record<string, string> = {
  content: 'bg-purple-100 text-purple-700',
  reputation: 'bg-yellow-100 text-yellow-700',
  acquisition: 'bg-blue-100 text-blue-700',
  conversion: 'bg-green-100 text-green-700',
  analytics: 'bg-indigo-100 text-indigo-700',
  technical: 'bg-gray-100 text-gray-700',
}

export default function ModulesPage() {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<ModuleCatalog[]>([])
  const [siteModules, setSiteModules] = useState<SiteModule[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    async function resolveSite() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: site } = await supabase.from('sites').select('id').eq('owner_user_id', user.id).single()
      if (site?.id) setSiteId(site.id)
      else {
        const { data: first } = await supabase.from('sites').select('id').limit(1).single()
        if (first?.id) setSiteId(first.id)
      }
    }
    void resolveSite()
  }, [supabase])

  const fetchData = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    const [catalogRes, modulesRes] = await Promise.all([
      supabase.from('module_catalog').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('site_modules').select('*').eq('site_id', siteId),
    ])
    if (catalogRes.data) setCatalog(catalogRes.data)
    if (modulesRes.data) setSiteModules(modulesRes.data)
    setLoading(false)
  }, [siteId, supabase])

  useEffect(() => { void fetchData() }, [fetchData])

  function isActive(moduleId: string) {
    return siteModules.some(sm => sm.module_id === moduleId && sm.status === 'active')
  }

  async function handleToggle(moduleId: string) {
    if (!siteId) return
    setToggling(moduleId)
    const existing = siteModules.find(sm => sm.module_id === moduleId)
    if (existing) {
      const newStatus = existing.status === 'active' ? 'cancelled' : 'active'
      await supabase.from('site_modules').update({
        status: newStatus,
        ...(newStatus === 'active' ? { activated_at: new Date().toISOString() } : { cancelled_at: new Date().toISOString() })
      }).eq('id', existing.id)
    } else {
      await supabase.from('site_modules').insert({
        site_id: siteId,
        module_id: moduleId,
        status: 'active',
        activated_at: new Date().toISOString()
      })
    }
    await fetchData()
    setToggling(null)
  }

  const activeCount = catalog.filter(m => isActive(m.id)).length
  const totalMonthly = catalog.filter(m => isActive(m.id)).reduce((s, m) => s + Number(m.price_monthly), 0)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
          <p className="mt-1 text-sm text-gray-500">Activez et configurez les modules IA pour votre site.</p>
        </div>
        <div className="flex items-center gap-4 rounded-xl bg-white px-5 py-3 shadow-sm border border-gray-100">
          <div className="text-center">
            <p className="text-lg font-bold text-[#F5A623]">{activeCount}</p>
            <p className="text-xs text-gray-400">Actifs</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{totalMonthly}&euro;</p>
            <p className="text-xs text-gray-400">/mois</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((mod) => {
            const active = isActive(mod.id)
            return (
              <div key={mod.id} className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${active ? 'border-[#F5A623] ring-1 ring-[#F5A623]/20' : 'border-gray-200'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[mod.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CATEGORY_LABELS[mod.category] ?? mod.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleToggle(mod.id)}
                    disabled={toggling === mod.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? 'bg-[#F5A623]' : 'bg-gray-200'} ${toggling === mod.id ? 'opacity-50' : ''}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">{mod.name}</h3>
                <p className="mb-3 text-xs text-gray-500 line-clamp-2">{mod.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-gray-900">{Number(mod.price_monthly)}&euro;</span>
                  <span className="text-xs text-gray-400">/mois</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
