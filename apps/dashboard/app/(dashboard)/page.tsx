'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '../../lib/supabase'

interface DashboardData {
  firstName: string
  email: string
  siteName: string
  role: string
  contentCount: number
  pendingCount: number
  reviewCount: number
  avgRating: string
  activeModules: number
  siteStatus: string
}

const QUICK_ACTIONS = [
  { label: 'Generer du contenu', href: '/content', icon: '✍️' },
  { label: 'Voir les avis', href: '/content/reviews', icon: '⭐' },
  { label: 'Gerer les modules', href: '/modules', icon: '🧩' },
  { label: 'Lancer l\'onboarding', href: '/onboarding', icon: '🚀' },
]

export default function DashboardHomePage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Get user info
      const { data: userData } = await supabase.from('users').select('role, first_name').eq('id', user.id).single()

      // Get site (own or first for superadmin)
      let site: { id: string; name: string; status: string } | null = null
      const { data: ownSite } = await supabase.from('sites').select('id, name, status').eq('owner_user_id', user.id).single()
      if (ownSite) site = ownSite
      else {
        const { data: firstSite } = await supabase.from('sites').select('id, name, status').limit(1).single()
        if (firstSite) site = firstSite
      }

      let contentCount = 0, pendingCount = 0, reviewCount = 0, avgRating = '0', activeModules = 0
      if (site) {
        const [contentsRes, pendingRes, reviewsRes, modulesRes] = await Promise.all([
          supabase.from('ai_contents').select('*', { count: 'exact', head: true }).eq('site_id', site.id),
          supabase.from('ai_contents').select('*', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'pending_validation'),
          supabase.from('google_reviews').select('id, rating').eq('site_id', site.id),
          supabase.from('site_modules').select('*', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'active'),
        ])
        contentCount = contentsRes.count ?? 0
        pendingCount = pendingRes.count ?? 0
        activeModules = modulesRes.count ?? 0
        if (reviewsRes.data && reviewsRes.data.length > 0) {
          reviewCount = reviewsRes.data.length
          avgRating = (reviewsRes.data.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviewsRes.data.length).toFixed(1)
        }
      }

      setData({
        firstName: userData?.first_name ?? user.email?.split('@')[0] ?? 'Utilisateur',
        email: user.email ?? '',
        siteName: site?.name ?? 'Aucun site',
        role: userData?.role ?? 'client',
        contentCount,
        pendingCount,
        reviewCount,
        avgRating,
        activeModules,
        siteStatus: site?.status ?? 'setup',
      })
      setLoading(false)
    }
    void loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
      </div>
    )
  }

  if (!data) return null

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    setup: { label: 'En configuration', color: 'bg-yellow-50 text-yellow-700' },
    staging: { label: 'En test', color: 'bg-blue-50 text-blue-700' },
    live: { label: 'En ligne', color: 'bg-green-50 text-green-700' },
    suspended: { label: 'Suspendu', color: 'bg-red-50 text-red-700' },
  }

  const status = STATUS_LABELS[data.siteStatus] ?? STATUS_LABELS.setup

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bienvenue, {data.firstName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {data.email} &middot;{' '}
          <span className="inline-flex items-center rounded-full bg-[#F5A623]/10 px-2 py-0.5 text-xs font-medium text-[#F5A623]">
            {data.role}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Contenus generes</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{data.contentCount}</p>
          <p className="mt-1 text-xs text-orange-500">{data.pendingCount} en attente</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Avis Google</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{data.reviewCount}</p>
          <p className="mt-1 text-xs text-yellow-500">{data.avgRating} &#9733; moyenne</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Modules actifs</p>
          <p className="mt-2 text-3xl font-bold text-[#F5A623]">{data.activeModules}</p>
          <p className="mt-1 text-xs text-gray-400">sur 3 disponibles</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Site</p>
          <p className="mt-2 text-lg font-bold text-gray-900">{data.siteName}</p>
          <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Actions rapides</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <a key={action.href} href={action.href}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-[#F5A623]/30">
              <span className="text-2xl">{action.icon}</span>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#F5A623] transition-colors">{action.label}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
