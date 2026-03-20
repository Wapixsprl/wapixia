'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '../../../lib/api'
import { createBrowserClient } from '../../../lib/supabase'

/* ---------- Types ---------- */

type Period = '1m' | '3m' | '6m' | '12m'

interface TrafficSource {
  source: string
  value: number
}

interface VisibilityPoint {
  date: string
  score: number
}

interface SEOData {
  impressions: number | null
  clicks: number | null
  position: number | null
  top_queries: { query: string; clicks: number; impressions: number; position: number }[]
}

interface LeadByType {
  type: string
  count: number
}

interface LeadItem {
  id: string
  type: string
  date: string
  source: string
  status: string
}

interface AnalyticsData {
  traffic_by_source: TrafficSource[]
  visibility_history: VisibilityPoint[]
  seo: SEOData
  leads_by_type: LeadByType[]
  leads_list: LeadItem[]
}

/* ---------- Period config ---------- */

const PERIODS: { key: Period; label: string }[] = [
  { key: '1m', label: 'Ce mois' },
  { key: '3m', label: '3 mois' },
  { key: '6m', label: '6 mois' },
  { key: '12m', label: '12 mois' },
]

/* ---------- Skeleton ---------- */

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )
}

/* ---------- Bar Chart (traffic by source) ---------- */

function TrafficBarChart({ data }: { data: TrafficSource[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Aucune donn&eacute;e
      </div>
    )
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1)

  const sourceColors: Record<string, string> = {
    organique: '#00D4B1',
    direct: '#6366F1',
    social: '#F59E0B',
    referral: '#EC4899',
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = (item.value / maxVal) * 100
        const color = sourceColors[item.source] ?? '#9CA3AF'
        return (
          <div key={item.source}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium capitalize text-gray-700">
                {item.source}
              </span>
              <span className="text-gray-500">{item.value}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Line Chart (visibility history) ---------- */

function VisibilityLineChart({ data }: { data: VisibilityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Aucune donn&eacute;e
      </div>
    )
  }

  const width = 500
  const height = 180
  const px = 30
  const py = 20
  const cw = width - px * 2
  const ch = height - py * 2

  const scores = data.map((d) => d.score)
  const maxS = Math.max(...scores, 100)
  const minS = Math.min(...scores, 0)
  const rangeS = maxS - minS || 1

  const points = data.map((d, i) => ({
    x: px + (i / (data.length - 1)) * cw,
    y: py + ch - ((d.score - minS) / rangeS) * ch,
  }))

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Grid */}
      {[0, 25, 50, 75, 100].map((val) => {
        const y = py + ch - ((val - minS) / rangeS) * ch
        return (
          <g key={val}>
            <line x1={px} y1={y} x2={width - px} y2={y} stroke="#F3F4F6" />
            <text x={px - 6} y={y + 4} textAnchor="end" fill="#9CA3AF" fontSize="9">
              {val}
            </text>
          </g>
        )
      })}
      <defs>
        <linearGradient id="visGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00D4B1" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#00D4B1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${linePath} L ${points[points.length - 1].x} ${py + ch} L ${points[0].x} ${py + ch} Z`}
        fill="url(#visGradient)"
      />
      <path
        d={linePath}
        fill="none"
        stroke="#00D4B1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#00D4B1" />
      ))}
    </svg>
  )
}

/* ---------- Donut Chart (leads by type) ---------- */

function LeadsDonut({ data }: { data: LeadByType[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">
        Aucun lead
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.count, 0)
  const colors = ['#00D4B1', '#6366F1', '#F59E0B', '#EC4899', '#8B5CF6']
  const radius = 60
  const cx = 80
  const cy = 80
  const strokeWidth = 20

  let cumulativeAngle = -90

  const arcs = data.map((item, i) => {
    const angle = (item.count / total) * 360
    const startAngle = cumulativeAngle
    const endAngle = cumulativeAngle + angle
    cumulativeAngle = endAngle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180
    const largeArc = angle > 180 ? 1 : 0

    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)

    return (
      <path
        key={item.type}
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
        fill="none"
        stroke={colors[i % colors.length]}
        strokeWidth={strokeWidth}
      />
    )
  })

  return (
    <div className="flex items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {arcs}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="bold" fill="#111827">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="#9CA3AF">
          leads
        </text>
      </svg>
      <ul className="space-y-2">
        {data.map((item, i) => (
          <li key={item.type} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-gray-600">{item.type}</span>
            <span className="font-semibold text-gray-900">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- Page ---------- */

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('1m')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)

  const fetchData = useCallback(
    async (sid: string, p: Period) => {
      setLoading(true)
      setError(null)
      try {
        const result = await apiClient<AnalyticsData>(
          `/api/v1/sites/${sid}/analytics?period=${p}`
        )
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    async function init() {
      try {
        const supabase = createBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const { data: site } = await supabase
          .from('sites')
          .select('id')
          .eq('owner_id', user?.id ?? '')
          .single()

        const id = site?.id as string | undefined

        if (id) {
          setSiteId(id)
          await fetchData(id, period)
        } else {
          setLoading(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
        setLoading(false)
      }
    }

    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    if (siteId) {
      void fetchData(siteId, p)
    }
  }

  if (loading) return <AnalyticsSkeleton />

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">Erreur : {error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          R&eacute;essayer
        </button>
      </div>
    )
  }

  const safe: AnalyticsData = data ?? {
    traffic_by_source: [],
    visibility_history: [],
    seo: { impressions: null, clicks: null, position: null, top_queries: [] },
    leads_by_type: [],
    leads_list: [],
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

        {/* Period filter */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePeriodChange(p.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                period === p.key
                  ? 'bg-[#00D4B1] text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Traffic + Visibility */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Traffic by source */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Trafic par source
          </h2>
          <TrafficBarChart data={safe.traffic_by_source} />
        </div>

        {/* Visibility history */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Historique du Score de Visibilit&eacute;
          </h2>
          <VisibilityLineChart data={safe.visibility_history} />
        </div>
      </div>

      {/* Row 2: SEO */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">SEO</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-xs font-medium text-gray-500">Impressions</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {safe.seo.impressions !== null ? safe.seo.impressions.toLocaleString() : '\u2013'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-xs font-medium text-gray-500">Clics</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {safe.seo.clicks !== null ? safe.seo.clicks.toLocaleString() : '\u2013'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-xs font-medium text-gray-500">
              Position moyenne
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {safe.seo.position !== null ? safe.seo.position.toFixed(1) : '\u2013'}
            </p>
          </div>
        </div>

        {/* Top queries */}
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Top 10 requ&ecirc;tes
        </h3>
        {safe.seo.top_queries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Requ&ecirc;te</th>
                  <th className="pb-2 pr-4 font-medium text-right">Clics</th>
                  <th className="pb-2 pr-4 font-medium text-right">Impressions</th>
                  <th className="pb-2 font-medium text-right">Position</th>
                </tr>
              </thead>
              <tbody>
                {safe.seo.top_queries.slice(0, 10).map((q) => (
                  <tr
                    key={q.query}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="py-2 pr-4 text-gray-800">{q.query}</td>
                    <td className="py-2 pr-4 text-right text-gray-600">
                      {q.clicks}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-600">
                      {q.impressions}
                    </td>
                    <td className="py-2 text-right text-gray-600">
                      {q.position.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucune requ&ecirc;te disponible</p>
        )}
      </div>

      {/* Row 3: Leads */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Donut */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Leads par type
          </h2>
          <LeadsDonut data={safe.leads_by_type} />
        </div>

        {/* Leads list */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Tous les leads
          </h2>
          {safe.leads_list.length > 0 ? (
            <ul className="space-y-3">
              {safe.leads_list.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {lead.type}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {lead.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{lead.date}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        lead.status === 'new'
                          ? 'bg-blue-100 text-blue-700'
                          : lead.status === 'contacted'
                            ? 'bg-yellow-100 text-yellow-700'
                            : lead.status === 'converted'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {lead.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Aucun lead</p>
          )}
        </div>
      </div>
    </div>
  )
}
