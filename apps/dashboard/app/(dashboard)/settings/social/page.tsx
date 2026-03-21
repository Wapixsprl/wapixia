'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '../../../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────
type Platform = 'facebook' | 'instagram' | 'linkedin' | 'google_my_business'

interface SocialAccount {
  id: string
  site_id: string
  platform: Platform
  platform_username: string | null
  platform_name: string | null
  status: string
  last_used_at: string | null
}

interface SiteGMB {
  gmb_location_id: string | null
  google_oauth_token: string | null
}

// ─── Constants ────────────────────────────────────────────────────
const PLATFORMS: { key: Platform; label: string; icon: JSX.Element; color: string }[] = [
  {
    key: 'facebook',
    label: 'Facebook',
    color: 'bg-blue-50 text-blue-600',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    color: 'bg-pink-50 text-pink-600',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    color: 'bg-sky-50 text-sky-600',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    key: 'google_my_business',
    label: 'Google My Business',
    color: 'bg-emerald-50 text-emerald-600',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
]

export default function SocialSettingsPage() {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [gmbInfo, setGmbInfo] = useState<SiteGMB | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [showComingSoon, setShowComingSoon] = useState<Platform | null>(null)

  const supabase = createBrowserClient()

  // Resolve site
  useEffect(() => {
    async function resolveSite() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .eq('owner_user_id', user.id)
        .single()
      if (site?.id) setSiteId(site.id)
      else {
        const { data: first } = await supabase.from('sites').select('id').limit(1).single()
        if (first?.id) setSiteId(first.id)
      }
    }
    void resolveSite()
  }, [supabase])

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    const [accountsRes, siteRes] = await Promise.all([
      supabase.from('social_accounts').select('*').eq('site_id', siteId),
      supabase.from('sites').select('gmb_location_id, google_oauth_token').eq('id', siteId).single(),
    ])
    if (accountsRes.data) setAccounts(accountsRes.data)
    if (siteRes.data) setGmbInfo(siteRes.data)
    setLoading(false)
  }, [siteId, supabase])

  useEffect(() => { void fetchData() }, [fetchData])

  function getAccount(platform: Platform): SocialAccount | undefined {
    return accounts.find(a => a.platform === platform)
  }

  function isConnected(platform: Platform): boolean {
    const acc = getAccount(platform)
    return !!acc && acc.status === 'connected'
  }

  async function handleDisconnect(account: SocialAccount) {
    setDisconnecting(account.id)
    await supabase.from('social_accounts').update({ status: 'disconnected' }).eq('id', account.id)
    await fetchData()
    setDisconnecting(null)
  }

  function handleConnect(platform: Platform) {
    setShowComingSoon(platform)
    setTimeout(() => setShowComingSoon(null), 3000)
  }

  const gmbConnected = !!(gmbInfo?.gmb_location_id && gmbInfo?.google_oauth_token)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reseaux sociaux</h1>
        <p className="mt-1 text-sm text-gray-500">Connectez vos comptes sociaux et votre fiche Google My Business.</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
        </div>
      ) : (
        <>
          {/* Coming soon banner */}
          {showComingSoon && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#F5A623]/30 bg-[#F5A623]/10 px-4 py-3">
              <svg className="h-5 w-5 text-[#F5A623]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-[#E09600]">
                Fonctionnalite bientot disponible pour {PLATFORMS.find(p => p.key === showComingSoon)?.label}.
              </p>
            </div>
          )}

          {/* Platform cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            {PLATFORMS.map(platform => {
              const account = getAccount(platform.key)
              const connected = isConnected(platform.key)

              return (
                <div
                  key={platform.key}
                  className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                    connected ? 'border-[#F5A623] ring-1 ring-[#F5A623]/20' : 'border-gray-200'
                  }`}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className={`rounded-xl p-2.5 ${platform.color}`}>
                      {platform.icon}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {connected ? 'Connecte' : 'Deconnecte'}
                    </span>
                  </div>

                  <h3 className="mb-1 text-sm font-semibold text-gray-900">{platform.label}</h3>

                  {connected && account ? (
                    <div className="mb-4">
                      {account.platform_username && (
                        <p className="text-sm text-gray-600">@{account.platform_username}</p>
                      )}
                      {account.platform_name && (
                        <p className="text-xs text-gray-400">{account.platform_name}</p>
                      )}
                      {account.last_used_at && (
                        <p className="mt-1 text-xs text-gray-400">
                          Derniere utilisation : {new Date(account.last_used_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mb-4 text-xs text-gray-400">Aucun compte connecte</p>
                  )}

                  {connected && account ? (
                    <button
                      type="button"
                      onClick={() => void handleDisconnect(account)}
                      disabled={disconnecting === account.id}
                      className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {disconnecting === account.id ? 'Deconnexion...' : 'Deconnecter'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConnect(platform.key)}
                      className="w-full rounded-lg bg-[#F5A623] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#E09600] transition-colors"
                    >
                      Connecter
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* GMB Section */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Fiche Google My Business</h2>
                <p className="text-sm text-gray-500">Connexion a votre fiche etablissement Google.</p>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                      gmbConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${gmbConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {gmbConnected ? 'Connecte' : 'Non connecte'}
                  </span>
                  {gmbConnected && gmbInfo?.gmb_location_id && (
                    <span className="text-xs text-gray-400">ID: {gmbInfo.gmb_location_id}</span>
                  )}
                </div>
              </div>

              {!gmbConnected && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#F5A623]/20 bg-[#F5A623]/5 px-3 py-2">
                  <svg className="h-4 w-4 text-[#F5A623]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-[#E09600]">
                    La connexion GMB se configure lors de l&apos;onboarding ou par un administrateur.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
