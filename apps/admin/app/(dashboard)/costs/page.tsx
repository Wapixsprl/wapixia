'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '../../../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SiteCost {
  pilotId: string
  pilotName: string
  claudeCost: number
  infraCost: number
  totalCost: number
  revenue: number
  margin: number
}

interface ModuleCost {
  module: string
  label: string
  totalCost: number
  callCount: number
}

interface InfraCost {
  label: string
  monthlyCost: number
}

interface CostData {
  sites: SiteCost[]
  modules: ModuleCost[]
  infra: InfraCost[]
  totals: {
    claudeMonthly: number
    infraMonthly: number
    revenueMonthly: number
    marginMonthly: number
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_COSTS: CostData = {
  sites: [
    { pilotId: 'pilot-a', pilotName: 'Pilote A (Coiffure)', claudeCost: 0, infraCost: 0, totalCost: 0, revenue: 0, margin: 0 },
    { pilotId: 'pilot-b', pilotName: 'Pilote B (BTP)', claudeCost: 0, infraCost: 0, totalCost: 0, revenue: 0, margin: 0 },
    { pilotId: 'pilot-c', pilotName: 'Pilote C (M\u00e9dical)', claudeCost: 0, infraCost: 0, totalCost: 0, revenue: 0, margin: 0 },
  ],
  modules: [
    { module: 'site_generation', label: 'G\u00e9n\u00e9ration site', totalCost: 0, callCount: 0 },
    { module: 'posts_rs', label: 'Posts r\u00e9seaux sociaux', totalCost: 0, callCount: 0 },
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
}

const CLAUDE_COST_ALERT_THRESHOLD = 4 // euros per month per site

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CostsPage() {
  const [data, setData] = useState<CostData>(DEFAULT_COSTS)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const res = await apiClient<{ data: CostData }>('/api/v1/admin/costs')
      setData(res.data)
    } catch {
      // API not ready, keep defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const alertSites = data.sites.filter((s) => s.claudeCost > CLAUDE_COST_ALERT_THRESHOLD)

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
        <h1 className="text-2xl font-bold text-gray-900">Suivi des co\u00fbts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitoring des d\u00e9penses Claude API et infrastructure
        </p>
      </div>

      {/* Alerts */}
      {alertSites.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-red-800">Alerte co\u00fbt Claude</h3>
          </div>
          <p className="mt-1 text-sm text-red-700">
            {alertSites.length} site(s) d\u00e9passent le seuil de {CLAUDE_COST_ALERT_THRESHOLD}\u20ac/mois :
            {' '}
            {alertSites.map((s) => `${s.pilotName} (${s.claudeCost.toFixed(2)}\u20ac)`).join(', ')}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Co\u00fbt Claude mensuel"
          value={`${data.totals.claudeMonthly.toFixed(2)} \u20ac`}
          color="text-gray-900"
        />
        <SummaryCard
          label="Co\u00fbt infra mensuel"
          value={`${data.totals.infraMonthly.toFixed(2)} \u20ac`}
          color="text-gray-900"
        />
        <SummaryCard
          label="Revenus mensuels"
          value={`${data.totals.revenueMonthly.toFixed(2)} \u20ac`}
          color="text-[#00D4B1]"
        />
        <SummaryCard
          label="Marge mensuelle"
          value={`${data.totals.marginMonthly.toFixed(2)} \u20ac`}
          color={data.totals.marginMonthly >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
      </div>

      {/* Revenue vs Costs Chart (simple bar visualization) */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Revenus vs Co\u00fbts</h2>
        <div className="mt-6 space-y-4">
          {data.sites.map((site) => {
            const maxVal = Math.max(site.revenue, site.totalCost, 1)
            return (
              <div key={site.pilotId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{site.pilotName}</span>
                  <span className="text-xs text-gray-500">
                    Marge : {site.margin.toFixed(2)} \u20ac
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-xs text-gray-500">Revenu</span>
                      <div className="flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-4 rounded-full bg-[#00D4B1]"
                          style={{ width: `${(site.revenue / maxVal) * 100}%`, minWidth: site.revenue > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="w-16 text-xs font-medium text-gray-700">
                        {site.revenue.toFixed(2)} \u20ac
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-xs text-gray-500">Co\u00fbts</span>
                      <div className="flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-4 rounded-full bg-orange-400"
                          style={{ width: `${(site.totalCost / maxVal) * 100}%`, minWidth: site.totalCost > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="w-16 text-xs font-medium text-gray-700">
                        {site.totalCost.toFixed(2)} \u20ac
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cost per site */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Co\u00fbt Claude par site</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Pilote
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Co\u00fbt Claude
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Co\u00fbt Infra
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Revenu
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Marge
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.sites.map((site) => (
                <tr
                  key={site.pilotId}
                  className={site.claudeCost > CLAUDE_COST_ALERT_THRESHOLD ? 'bg-red-50' : ''}
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {site.pilotName}
                    {site.claudeCost > CLAUDE_COST_ALERT_THRESHOLD && (
                      <span className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        &gt; {CLAUDE_COST_ALERT_THRESHOLD}\u20ac
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
                    {site.claudeCost.toFixed(2)} \u20ac
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
                    {site.infraCost.toFixed(2)} \u20ac
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {site.totalCost.toFixed(2)} \u20ac
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-[#00D4B1]">
                    {site.revenue.toFixed(2)} \u20ac
                  </td>
                  <td
                    className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${
                      site.margin >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {site.margin.toFixed(2)} \u20ac
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost per module */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Co\u00fbt Claude par module</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Module
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Appels
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Co\u00fbt total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.modules.map((mod) => (
                <tr key={mod.module}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {mod.label}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
                    {mod.callCount.toLocaleString('fr-FR')}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {mod.totalCost.toFixed(2)} \u20ac
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Infrastructure costs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Co\u00fbts infrastructure</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Service
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Co\u00fbt mensuel
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.infra.map((item) => (
                <tr key={item.label}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {item.label}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {item.monthlyCost.toFixed(2)} \u20ac
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
