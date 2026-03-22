'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '../../../lib/supabase'

type SettingsTab = 'profil' | 'organisation' | 'utilisateurs'

interface UserProfile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  avatar_url: string | null
  language: string | null
  role: string
  organization_id: string | null
}

interface OrgData {
  id: string
  name: string
  white_label_logo_url: string | null
  white_label_primary: string | null
  white_label_domain: string | null
  white_label_name: string | null
}

interface OrgUser {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
  avatar_url: string | null
  created_at: string
}

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'profil', label: 'Profil' },
  { key: 'organisation', label: 'Organisation' },
  { key: 'utilisateurs', label: 'Utilisateurs' },
]

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-red-50 text-red-700',
  admin: 'bg-purple-50 text-purple-700',
  manager: 'bg-blue-50 text-blue-700',
  client: 'bg-gray-100 text-gray-600',
  editor: 'bg-green-50 text-green-700',
}

const LANGUAGES = [
  { value: 'fr', label: 'Francais' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ar', label: 'Arabe' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profil')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    avatar_url: '',
    language: 'fr',
  })

  // Org state
  const [org, setOrg] = useState<OrgData | null>(null)
  const [orgForm, setOrgForm] = useState({
    name: '',
    white_label_logo_url: '',
    white_label_primary: '#F5A623',
    white_label_domain: '',
    white_label_name: '',
  })

  // Users state
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])

  const supabase = createBrowserClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Fetch user profile
    const { data: userData } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, phone, avatar_url, language, role, organization_id')
      .eq('id', user.id)
      .single()

    if (userData) {
      setProfile(userData)
      setProfileForm({
        first_name: userData.first_name ?? '',
        last_name: userData.last_name ?? '',
        email: userData.email ?? user.email ?? '',
        phone: userData.phone ?? '',
        avatar_url: userData.avatar_url ?? '',
        language: userData.language ?? 'fr',
      })

      // Fetch org data if user has an org
      if (userData.organization_id) {
        const [orgRes, usersRes] = await Promise.all([
          supabase.from('organizations').select('id, name, white_label_logo_url, white_label_primary, white_label_domain, white_label_name').eq('id', userData.organization_id).single(),
          supabase.from('users').select('id, first_name, last_name, email, role, avatar_url, created_at').eq('organization_id', userData.organization_id).order('created_at'),
        ])

        if (orgRes.data) {
          setOrg(orgRes.data)
          setOrgForm({
            name: orgRes.data.name ?? '',
            white_label_logo_url: orgRes.data.white_label_logo_url ?? '',
            white_label_primary: orgRes.data.white_label_primary ?? '#F5A623',
            white_label_domain: orgRes.data.white_label_domain ?? '',
            white_label_name: orgRes.data.white_label_name ?? '',
          })
        }
        if (usersRes.data) setOrgUsers(usersRes.data)
      }
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])

  function showSaveMsg(msg: string) {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({
        first_name: profileForm.first_name || null,
        last_name: profileForm.last_name || null,
        phone: profileForm.phone || null,
        avatar_url: profileForm.avatar_url || null,
        language: profileForm.language || 'fr',
      })
      .eq('id', profile.id)

    setSaving(false)
    if (error) showSaveMsg('Erreur lors de la sauvegarde.')
    else showSaveMsg('Profil mis a jour avec succes.')
  }

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    setSaving(true)
    const { error } = await supabase
      .from('organizations')
      .update({
        name: orgForm.name || null,
        white_label_logo_url: orgForm.white_label_logo_url || null,
        white_label_primary: orgForm.white_label_primary || null,
        white_label_domain: orgForm.white_label_domain || null,
        white_label_name: orgForm.white_label_name || null,
      })
      .eq('id', org.id)

    setSaving(false)
    if (error) showSaveMsg('Erreur lors de la sauvegarde.')
    else showSaveMsg('Organisation mise a jour avec succes.')
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
      </div>
    )
  }

  const inputClassName = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20'
  const labelClassName = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>
        <p className="mt-1 text-sm text-gray-500">Gerez votre profil, votre organisation et les utilisateurs.</p>
      </div>

      {/* Save message */}
      {saveMsg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
          saveMsg.includes('Erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {saveMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profil Tab */}
      {activeTab === 'profil' && (
        <form onSubmit={(e) => void handleSaveProfile(e)} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">Informations personnelles</h2>

          {/* Avatar preview */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5A623]/10 text-[#F5A623] text-xl font-bold overflow-hidden">
              {profileForm.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileForm.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span>{(profileForm.first_name?.[0] ?? profileForm.email?.[0] ?? 'U').toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{profileForm.first_name} {profileForm.last_name}</p>
              <p className="text-xs text-gray-500">{profileForm.email}</p>
              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[profile?.role ?? 'client'] ?? ROLE_COLORS.client}`}>
                {profile?.role ?? 'client'}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClassName}>Prenom</label>
              <input
                type="text"
                value={profileForm.first_name}
                onChange={(e) => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="Votre prenom"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Nom</label>
              <input
                type="text"
                value={profileForm.last_name}
                onChange={(e) => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Votre nom"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Email</label>
              <input
                type="email"
                value={profileForm.email}
                disabled
                className={`${inputClassName} bg-gray-50 text-gray-400 cursor-not-allowed`}
              />
              <p className="mt-1 text-xs text-gray-400">L&apos;email ne peut pas etre modifie ici.</p>
            </div>
            <div>
              <label className={labelClassName}>Telephone</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+33 6 12 34 56 78"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>URL de l&apos;avatar</label>
              <input
                type="url"
                value={profileForm.avatar_url}
                onChange={(e) => setProfileForm(f => ({ ...f, avatar_url: e.target.value }))}
                placeholder="https://exemple.com/avatar.jpg"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Langue</label>
              <select
                value={profileForm.language}
                onChange={(e) => setProfileForm(f => ({ ...f, language: e.target.value }))}
                className={inputClassName}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#F5A623] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#E09600] disabled:opacity-50"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder le profil'}
            </button>
          </div>
        </form>
      )}

      {/* Organisation Tab */}
      {activeTab === 'organisation' && (
        <div>
          {!org ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
              <p className="text-sm text-gray-400">Aucune organisation associee a votre compte.</p>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSaveOrg(e)} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-semibold text-gray-900">Organisation</h2>

              {/* Logo preview */}
              {orgForm.white_label_logo_url && (
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={orgForm.white_label_logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="text-sm text-gray-500">Logo actuel de l&apos;organisation</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>Nom de l&apos;organisation</label>
                  <input
                    type="text"
                    value={orgForm.name}
                    onChange={(e) => setOrgForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Mon entreprise"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Domaine white-label</label>
                  <input
                    type="text"
                    value={orgForm.white_label_domain}
                    onChange={(e) => setOrgForm(f => ({ ...f, white_label_domain: e.target.value }))}
                    placeholder="app.monentreprise.com"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Nom white-label</label>
                  <input
                    type="text"
                    value={orgForm.white_label_name}
                    onChange={(e) => setOrgForm(f => ({ ...f, white_label_name: e.target.value }))}
                    placeholder="Mon Agence"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>URL du logo</label>
                  <input
                    type="url"
                    value={orgForm.white_label_logo_url}
                    onChange={(e) => setOrgForm(f => ({ ...f, white_label_logo_url: e.target.value }))}
                    placeholder="https://exemple.com/logo.png"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Couleur principale</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={orgForm.white_label_primary}
                      onChange={(e) => setOrgForm(f => ({ ...f, white_label_primary: e.target.value }))}
                      className="h-10 w-10 cursor-pointer rounded border border-gray-200"
                    />
                    <input
                      type="text"
                      value={orgForm.white_label_primary}
                      onChange={(e) => setOrgForm(f => ({ ...f, white_label_primary: e.target.value }))}
                      placeholder="#F5A623"
                      className={inputClassName}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#F5A623] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#E09600] disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder l\'organisation'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Utilisateurs Tab */}
      {activeTab === 'utilisateurs' && (
        <div>
          {orgUsers.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
              <p className="text-sm text-gray-400">Aucun utilisateur dans cette organisation.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Utilisateurs de l&apos;organisation</h2>
                <p className="mt-1 text-sm text-gray-500">{orgUsers.length} membre{orgUsers.length > 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {orgUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5A623]/10 text-[#F5A623] text-sm font-bold overflow-hidden shrink-0">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{(u.first_name?.[0] ?? u.email?.[0] ?? 'U').toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {u.first_name || u.last_name
                          ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                          : u.email}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? ROLE_COLORS.client}`}>
                      {u.role}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
