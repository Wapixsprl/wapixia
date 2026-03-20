'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '../../../lib/api'
import { createBrowserClient } from '../../../lib/supabase'
import VisibilityGauge from './components/VisibilityGauge'
import KPICard from './components/KPICard'
import TrafficChart from './components/TrafficChart'

/* ---------- Types ---------- */

interface PillarScore {
  label: string
  score: number
}

interface KPI {
  value: number | null
  delta: number | null
}

interface TrafficPoint {
  date: string
  value: number
}

interface ContentCount {
  type: string
  count: number
}

interface Lead {
  id: string
  type: string
  date: string
  status: string
}

interface GoogleConnection {
  service: string
  connected: boolean
}

interface DashboardData {
  visibility_score: number | null
  pillars: PillarScore[]
  kpis: {
    visites: KPI
    leads: KPI
    avis: KPI
    position_google: KPI
  }
  traffic_30d: TrafficPoint[]
  content_this_month: ContentCount[]
  recent_leads: Lead[]
  pending_content_count: number
  google_connections: GoogleConnection[]
}

/* ---------- Icons (inline SVG) ---------- */

function IconVisites() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconLeads() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function IconAvis() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function IconPosition() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

/* ---------- Skeleton ---------- */

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <Skeleton className="mx-auto h-32 w-48" />
          <div className="mt-4 grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
        <div className="col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  )
}

/* ---------- Helpers ---------- */

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return '\u2013'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function statusBadge(status: string): string {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-700'
    case 'contacted':
      return 'bg-yellow-100 text-yellow-700'
    case 'converted':
      return 'bg-emerald-100 text-emerald-700'
    case 'lost':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

/* ---------- Page ---------- */

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('Utilisateur')

  useEffect(() => {
    async function load() {
      try {
        const supabase = createBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          setFirstName(
            (user.user_metadata?.first_name as string) ??
              (user.user_metadata?.firstName as string) ??
              user.email?.split('@')[0] ??
              'Utilisateur'
          )
        }

        // Get siteId from user's sites
        const { data: site } = await supabase
          .from('sites')
          .select('id')
          .eq('owner_id', user?.id ?? '')
          .single()

        const siteId = site?.id as string | undefined

        if (siteId) {
          const result = await apiClient<DashboardData>(
            `/api/v1/sites/${siteId}/dashboard`
          )
          setData(result)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  if (loading) return <OverviewSkeleton />

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

  const safeData: DashboardData = data ?? {
    visibility_score: null,
    pillars: [],
    kpis: {
      visites: { value: null, delta: null },
      leads: { value: null, delta: null },
      avis: { value: null, delta: null },
      position_google: { value: null, delta: null },
    },
    traffic_30d: [],
    content_this_month: [],
    recent_leads: [],
    pending_content_count: 0,
    google_connections: [],
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenue, {firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Vue d&apos;ensemble de votre visibilit&eacute; en ligne
        </p>
      </div>

      {/* Main grid: Gauge + KPIs + Chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Visibility Score */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Score de Visibilit&eacute;
          </h2>
          {safeData.visibility_score !== null ? (
            <VisibilityGauge
              score={safeData.visibility_score}
              pillars={safeData.pillars}
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">
              Score non disponible
            </div>
          )}
        </div>

        {/* Right column: KPIs + chart */}
        <div className="col-span-1 space-y-4 lg:col-span-2">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KPICard
              icon={<IconVisites />}
              label="Visites"
              value={formatNumber(safeData.kpis.visites.value)}
              delta={safeData.kpis.visites.delta}
            />
            <KPICard
              icon={<IconLeads />}
              label="Leads"
              value={formatNumber(safeData.kpis.leads.value)}
              delta={safeData.kpis.leads.delta}
            />
            <KPICard
              icon={<IconAvis />}
              label="Avis"
              value={formatNumber(safeData.kpis.avis.value)}
              delta={safeData.kpis.avis.delta}
            />
            <KPICard
              icon={<IconPosition />}
              label="Position Google"
              value={
                safeData.kpis.position_google.value !== null
                  ? `#${safeData.kpis.position_google.value}`
                  : null
              }
              delta={safeData.kpis.position_google.delta}
            />
          </div>

          {/* Traffic Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Trafic &mdash; 30 derniers jours
            </h3>
            <TrafficChart data={safeData.traffic_30d} />
          </div>
        </div>
      </div>

      {/* Bottom sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ce mois */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Ce mois</h3>
          {safeData.content_this_month.length > 0 ? (
            <ul className="space-y-2">
              {safeData.content_this_month.map((item) => (
                <li
                  key={item.type}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600">{item.type}</span>
                  <span className="font-semibold text-gray-900">
                    {item.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">
              Aucun contenu publi&eacute; ce mois
            </p>
          )}

          {safeData.pending_content_count > 0 && (
            <Link
              href="/content"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#00D4B1] hover:underline"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00D4B1] text-[10px] font-bold text-white">
                {safeData.pending_content_count}
              </span>
              Contenus en attente
            </Link>
          )}
        </div>

        {/* Derniers leads */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Derniers leads
          </h3>
          {safeData.recent_leads.length > 0 ? (
            <ul className="space-y-3">
              {safeData.recent_leads.slice(0, 5).map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {lead.type}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {lead.date}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(lead.status)}`}
                  >
                    {lead.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Aucun lead r&eacute;cent</p>
          )}
        </div>

        {/* Google connections */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Connexions Google
          </h3>
          {safeData.google_connections.length > 0 ? (
            <ul className="space-y-3">
              {safeData.google_connections.map((conn) => (
                <li
                  key={conn.service}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600">{conn.service}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      conn.connected
                        ? 'text-emerald-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        conn.connected ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    />
                    {conn.connected ? 'Connect\u00e9' : 'Non connect\u00e9'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">
              Aucune connexion configur&eacute;e
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
