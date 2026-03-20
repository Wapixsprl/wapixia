'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '../../lib/supabase'

interface UserProfile {
  firstName: string
  email: string
  siteName: string
  role: string
}

const QUICK_ACTIONS = [
  { label: 'Generer du contenu', href: '/content', color: '#F5A623', icon: '✍️' },
  { label: 'Voir les avis', href: '/content/reviews', color: '#3B82F6', icon: '⭐' },
  { label: 'Gerer les modules', href: '/modules', color: '#8B5CF6', icon: '🧩' },
  { label: 'Lancer l\'onboarding', href: '/onboarding', color: '#F59E0B', icon: '🚀' },
]

const STATS = [
  { label: 'Pages generees', value: '6', change: '+6 ce mois', icon: '📄' },
  { label: 'Posts sociaux', value: '0', change: 'A configurer', icon: '📱' },
  { label: 'Avis Google', value: '0', change: 'En attente', icon: '⭐' },
  { label: 'Score visibilite', value: '--', change: 'Bientot disponible', icon: '📊' },
]

export default function DashboardHomePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createBrowserClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        let siteName = 'Mon Site'
        let role = 'client'

        const { data: site } = await supabase
          .from('sites')
          .select('name')
          .eq('owner_id', user.id)
          .single()

        if (site?.name) {
          siteName = site.name
        }

        const { data: userData } = await supabase
          .from('users')
          .select('role, first_name')
          .eq('id', user.id)
          .single()

        if (userData?.role) {
          role = userData.role
        }

        setProfile({
          firstName:
            userData?.first_name ??
            (user.user_metadata?.first_name as string) ??
            user.email?.split('@')[0] ??
            'Utilisateur',
          email: user.email ?? '',
          siteName,
          role,
        })
      }

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenue, {profile?.firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {profile?.email} &middot; <span className="inline-flex items-center rounded-full bg-[#F5A623]/10 px-2 py-0.5 text-xs font-medium text-[#F5A623]">{profile?.role}</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
            <p className="mt-1 text-xs text-gray-400">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Actions rapides</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl"
                style={{ backgroundColor: `${action.color}15` }}
              >
                {action.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#F5A623] transition-colors">
                  {action.label}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Site Info */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Mon site</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{profile?.siteName}</h3>
              <p className="mt-1 text-sm text-gray-500">Organisation WapixIA</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              Actif
            </span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500">Statut</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">En ligne</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500">Theme</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Par defaut</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500">Derniere MAJ</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Aujourd'hui</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
