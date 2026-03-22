'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '../../../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SiteData {
  id: string
  organization_id: string | null
  owner_user_id: string | null
  name: string
  slug: string | null
  sector: string | null
  temp_domain: string | null
  custom_domain: string | null
  domain_verified: boolean | null
  ssl_status: string | null
  hosting_type: string | null
  hosting_config: Record<string, unknown> | null
  plan: string | null
  plan_price: number | null
  onboarding_data: Record<string, unknown> | null
  onboarding_done: boolean
  launched_at: string | null
  google_analytics_id: string | null
  google_tag_manager_id: string | null
  google_search_console: string | null
  facebook_pixel_id: string | null
  gmb_location_id: string | null
  status: string
  visibility_score: number | null
  seo_score: number | null
  ai_presence_score: number | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
  theme: string | null
  primary_color: string | null
  secondary_color: string | null
  coolify_app_id: string | null
  cloudflare_record_id: string | null
  google_oauth_token: string | null
}

interface Organization {
  id: string
  name: string
}

interface OnboardingSession {
  id: string
  site_id: string
  user_id: string | null
  current_step: number
  total_steps: number | null
  answers: Record<string, unknown>
  generation_status: string | null
  generated_content: Record<string, unknown> | null
  generation_started_at: string | null
  generation_done_at: string | null
  error_message: string | null
  tokens_used: number | null
  created_at: string
  updated_at: string | null
}

interface ContentItem {
  id: string
  type: string
  title: string
  status: string
  created_at: string
}

interface Review {
  id: string
  author_name: string | null
  rating: number
  comment: string | null
  created_at: string
}

interface SiteModule {
  id: string
  module_id: string
  status: string
  activated_at: string | null
  module_catalog: { name: string; category: string } | null
}

interface SitePage {
  id: string
  title: string
  slug: string
  page_type: string
  status: string
  sort_order: number
  show_in_nav: boolean
  show_in_footer: boolean
  meta_title: string | null
  meta_description: string | null
  sections: unknown[]
  language: string
  published_at: string | null
  created_at: string
}

type TabKey = 'informations' | 'onboarding' | 'content' | 'reviews' | 'modules' | 'integrations' | 'cms'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  setup: { label: 'En configuration', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  staging: { label: 'En test', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  live: { label: 'En ligne', color: 'bg-green-50 text-green-700 border-green-200' },
  suspended: { label: 'Suspendu', color: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Annule', color: 'bg-gray-50 text-gray-700 border-gray-200' },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'informations', label: 'Informations' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'content', label: 'Contenus' },
  { key: 'reviews', label: 'Avis' },
  { key: 'modules', label: 'Modules' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'cms', label: 'Pages CMS' },
]

const TYPE_LABELS: Record<string, string> = {
  blog_article: 'Article Blog',
  social_post: 'Post Social',
  gmb_post: 'Post GMB',
  review_reply: 'Reponse Avis',
  seo_meta: 'SEO Meta',
  faq: 'FAQ',
}

const SECTOR_OPTIONS = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'beauty', label: 'Beaute' },
  { value: 'retail', label: 'Commerce' },
  { value: 'construction', label: 'Construction' },
  { value: 'health', label: 'Sante' },
  { value: 'education', label: 'Education' },
  { value: 'tech', label: 'Tech' },
  { value: 'legal', label: 'Juridique' },
  { value: 'realestate', label: 'Immobilier' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Autre' },
]

const STATUS_OPTIONS = [
  { value: 'setup', label: 'En configuration' },
  { value: 'staging', label: 'En test' },
  { value: 'live', label: 'En ligne' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'cancelled', label: 'Annule' },
]

const PLAN_OPTIONS = [
  { value: 'subscription', label: 'Abonnement' },
  { value: 'one_time', label: 'Paiement unique' },
  { value: 'free', label: 'Gratuit' },
]

// ─── Toast Component ─────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg text-sm font-medium transition-all ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function SiteDetailPage() {
  const params = useParams()
  const siteId = params.siteId as string

  const [site, setSite] = useState<SiteData | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingSession | null>(null)
  const [contents, setContents] = useState<ContentItem[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [modules, setModules] = useState<SiteModule[]>([])
  const [pages, setPages] = useState<SitePage[]>([])
  const [showPageModal, setShowPageModal] = useState(false)
  const [editingPage, setEditingPage] = useState<SitePage | null>(null)
  const [pageForm, setPageForm] = useState({ title: '', slug: '', page_type: 'page', status: 'draft', show_in_nav: true, show_in_footer: false, meta_title: '', meta_description: '' })
  const [stats, setStats] = useState({ contentCount: 0, reviewCount: 0, activeModules: 0, avgRating: '0' })
  const [activeTab, setActiveTab] = useState<TabKey>('informations')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state for Informations tab
  const [infoForm, setInfoForm] = useState({
    name: '',
    slug: '',
    sector: '',
    temp_domain: '',
    custom_domain: '',
    status: 'setup',
    plan: '',
    plan_price: '',
    theme: '',
    primary_color: '#F5A623',
    secondary_color: '#333333',
    hosting_type: '',
  })

  // Form state for Onboarding tab
  const [onboardingAnswers, setOnboardingAnswers] = useState<Record<string, unknown>>({})

  // Form state for Integrations tab
  const [integrationsForm, setIntegrationsForm] = useState({
    google_analytics_id: '',
    google_tag_manager_id: '',
    google_search_console: '',
    facebook_pixel_id: '',
    gmb_location_id: '',
  })

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const supabase = createBrowserClient()
  const inputClassName = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20'

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  // ─── Load Data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!siteId) return
    setLoading(true)

    const { data: siteData } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single()

    if (!siteData) { setLoading(false); return }
    setSite(siteData)

    // Populate info form
    setInfoForm({
      name: siteData.name ?? '',
      slug: siteData.slug ?? '',
      sector: siteData.sector ?? '',
      temp_domain: siteData.temp_domain ?? '',
      custom_domain: siteData.custom_domain ?? '',
      status: siteData.status ?? 'setup',
      plan: siteData.plan ?? '',
      plan_price: siteData.plan_price != null ? String(siteData.plan_price) : '',
      theme: siteData.theme ?? '',
      primary_color: siteData.primary_color ?? '#F5A623',
      secondary_color: siteData.secondary_color ?? '#333333',
      hosting_type: siteData.hosting_type ?? '',
    })

    // Populate integrations form
    setIntegrationsForm({
      google_analytics_id: siteData.google_analytics_id ?? '',
      google_tag_manager_id: siteData.google_tag_manager_id ?? '',
      google_search_console: siteData.google_search_console ?? '',
      facebook_pixel_id: siteData.facebook_pixel_id ?? '',
      gmb_location_id: siteData.gmb_location_id ?? '',
    })

    // Fetch org, onboarding, contents, reviews, modules in parallel
    const [orgRes, onbRes, contentsRes, reviewsRes, modulesRes, contentCountRes, activeModRes, pagesRes] = await Promise.all([
      siteData.organization_id
        ? supabase.from('organizations').select('id, name').eq('id', siteData.organization_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('onboarding_sessions').select('*').eq('site_id', siteId).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('ai_contents').select('id, type, title, status, created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(20),
      supabase.from('google_reviews').select('id, author_name, rating, comment, created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(20),
      supabase.from('site_modules').select('id, module_id, status, activated_at, module_catalog(name, category)').eq('site_id', siteId),
      supabase.from('ai_contents').select('*', { count: 'exact', head: true }).eq('site_id', siteId),
      supabase.from('site_modules').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'active'),
      supabase.from('site_pages').select('id, title, slug, page_type, status, sort_order, show_in_nav, show_in_footer, meta_title, meta_description, sections, language, published_at, created_at').eq('site_id', siteId).order('sort_order'),
    ])

    if (orgRes.data) setOrg(orgRes.data)
    if (onbRes.data) {
      setOnboarding(onbRes.data)
      setOnboardingAnswers(onbRes.data.answers ?? {})
    }
    if (contentsRes.data) setContents(contentsRes.data)
    if (reviewsRes.data) setReviews(reviewsRes.data)
    if (modulesRes.data) setModules(modulesRes.data as unknown as SiteModule[])
    if (pagesRes.data) setPages(pagesRes.data as unknown as SitePage[])

    const reviewList = reviewsRes.data ?? []
    const avg = reviewList.length > 0
      ? (reviewList.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviewList.length).toFixed(1)
      : '0'

    setStats({
      contentCount: contentCountRes.count ?? 0,
      reviewCount: reviewList.length,
      activeModules: activeModRes.count ?? 0,
      avgRating: avg,
    })

    setLoading(false)
  }, [siteId, supabase])

  useEffect(() => { void loadData() }, [loadData])

  // ─── Save Handlers ─────────────────────────────────────────────────────────

  const saveInformations = async () => {
    if (!site) return
    setSaving(true)
    const { error } = await supabase
      .from('sites')
      .update({
        name: infoForm.name,
        slug: infoForm.slug || null,
        sector: infoForm.sector || null,
        temp_domain: infoForm.temp_domain || null,
        custom_domain: infoForm.custom_domain || null,
        status: infoForm.status,
        plan: infoForm.plan || null,
        plan_price: infoForm.plan_price ? parseFloat(infoForm.plan_price) : null,
        theme: infoForm.theme || null,
        primary_color: infoForm.primary_color || null,
        secondary_color: infoForm.secondary_color || null,
        hosting_type: infoForm.hosting_type || null,
      })
      .eq('id', site.id)

    setSaving(false)
    if (error) {
      showToast(`Erreur: ${error.message}`, 'error')
    } else {
      showToast('Informations enregistrees avec succes', 'success')
      void loadData()
    }
  }

  const saveOnboarding = async () => {
    if (!onboarding) return
    setSaving(true)
    const { error } = await supabase
      .from('onboarding_sessions')
      .update({ answers: onboardingAnswers })
      .eq('id', onboarding.id)

    setSaving(false)
    if (error) {
      showToast(`Erreur: ${error.message}`, 'error')
    } else {
      showToast('Donnees d\'onboarding enregistrees avec succes', 'success')
      void loadData()
    }
  }

  const saveIntegrations = async () => {
    if (!site) return
    setSaving(true)
    const { error } = await supabase
      .from('sites')
      .update({
        google_analytics_id: integrationsForm.google_analytics_id || null,
        google_tag_manager_id: integrationsForm.google_tag_manager_id || null,
        google_search_console: integrationsForm.google_search_console || null,
        facebook_pixel_id: integrationsForm.facebook_pixel_id || null,
        gmb_location_id: integrationsForm.gmb_location_id || null,
      })
      .eq('id', site.id)

    setSaving(false)
    if (error) {
      showToast(`Erreur: ${error.message}`, 'error')
    } else {
      showToast('Integrations enregistrees avec succes', 'success')
      void loadData()
    }
  }

  // ─── Onboarding Answer Helpers ─────────────────────────────────────────────

  const updateOnboardingAnswer = (key: string, value: unknown) => {
    setOnboardingAnswers(prev => ({ ...prev, [key]: value }))
  }

  const renderOnboardingField = (key: string, value: unknown) => {
    if (typeof value === 'boolean') {
      return (
        <label className="flex items-center gap-2 mt-1">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => updateOnboardingAnswer(key, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#F5A623] focus:ring-[#F5A623]"
          />
          <span className="text-sm text-gray-600">{value ? 'Oui' : 'Non'}</span>
        </label>
      )
    }
    if (typeof value === 'object' && value !== null) {
      return (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              updateOnboardingAnswer(key, parsed)
            } catch {
              // Keep raw string while user is typing invalid JSON
            }
          }}
          rows={4}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
        />
      )
    }
    const strValue = String(value ?? '')
    if (strValue.length > 100) {
      return (
        <textarea
          value={strValue}
          onChange={(e) => updateOnboardingAnswer(key, e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
        />
      )
    }
    return (
      <input
        type="text"
        value={strValue}
        onChange={(e) => updateOnboardingAnswer(key, e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
      />
    )
  }

  // ─── Loading / Not Found ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
      </div>
    )
  }

  if (!site) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
        <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-gray-400">Site introuvable.</p>
        <a href="/sites" className="mt-3 text-sm font-medium text-[#F5A623] hover:underline">Retour aux sites</a>
      </div>
    )
  }

  const status = STATUS_LABELS[site.status] ?? { label: 'En configuration', color: 'border-yellow-300 text-yellow-700 bg-yellow-50' }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
        <a href="/sites" className="hover:text-[#F5A623] transition-colors">Sites</a>
        <span>/</span>
        <span className="text-gray-700">{site.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            {(site.custom_domain || site.temp_domain) && <span>{site.custom_domain || site.temp_domain}</span>}
            {org && <span>Organisation: {org.name}</span>}
            {site.sector && <span>Secteur: {site.sector}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`/content?site=${siteId}`}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Voir contenus
          </a>
          <a
            href={`/modules?site=${siteId}`}
            className="rounded-lg bg-[#F5A623] px-3 py-2 text-sm font-medium text-white hover:bg-[#E09600] transition-colors"
          >
            Gerer modules
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Contenus</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.contentCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Avis Google</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.reviewCount}</p>
          <p className="mt-1 text-xs text-yellow-500">{stats.avgRating} &#9733; moyenne</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Modules actifs</p>
          <p className="mt-2 text-3xl font-bold text-[#F5A623]">{stats.activeModules}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Score visibilite</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{site.visibility_score ?? '--'}%</p>
          {site.visibility_score != null && (
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#F5A623]"
                style={{ width: `${Math.min(100, site.visibility_score)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════ INFORMATIONS TAB ═══════════ */}
      {activeTab === 'informations' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">Informations du site</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Nom</label>
              <input
                type="text"
                value={infoForm.name}
                onChange={(e) => setInfoForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
              />
            </div>
            {/* Slug */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Slug</label>
              <input
                type="text"
                value={infoForm.slug}
                onChange={(e) => setInfoForm(f => ({ ...f, slug: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
              />
            </div>
            {/* Sector */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Secteur</label>
              <select
                value={infoForm.sector}
                onChange={(e) => setInfoForm(f => ({ ...f, sector: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none bg-white"
              >
                <option value="">-- Choisir --</option>
                {SECTOR_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {/* Temp Domain */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Domaine temporaire</label>
              <input
                type="text"
                value={infoForm.temp_domain}
                onChange={(e) => setInfoForm(f => ({ ...f, temp_domain: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
              />
            </div>
            {/* Custom Domain */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Domaine personnalise</label>
              <input
                type="text"
                value={infoForm.custom_domain}
                onChange={(e) => setInfoForm(f => ({ ...f, custom_domain: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
              />
            </div>
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</label>
              <select
                value={infoForm.status}
                onChange={(e) => setInfoForm(f => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none bg-white"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {/* Plan */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</label>
              <select
                value={infoForm.plan}
                onChange={(e) => setInfoForm(f => ({ ...f, plan: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none bg-white"
              >
                <option value="">-- Choisir --</option>
                {PLAN_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {/* Plan Price */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Prix du plan (EUR)</label>
              <input
                type="number"
                step="0.01"
                value={infoForm.plan_price}
                onChange={(e) => setInfoForm(f => ({ ...f, plan_price: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                placeholder="0.00"
              />
            </div>
            {/* Theme */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Theme</label>
              <input
                type="text"
                value={infoForm.theme}
                onChange={(e) => setInfoForm(f => ({ ...f, theme: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                placeholder="ex: modern, classic..."
              />
            </div>
            {/* Primary Color */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Couleur primaire</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={infoForm.primary_color}
                  onChange={(e) => setInfoForm(f => ({ ...f, primary_color: e.target.value }))}
                  className="h-10 w-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={infoForm.primary_color}
                  onChange={(e) => setInfoForm(f => ({ ...f, primary_color: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                />
              </div>
            </div>
            {/* Secondary Color */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Couleur secondaire</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={infoForm.secondary_color}
                  onChange={(e) => setInfoForm(f => ({ ...f, secondary_color: e.target.value }))}
                  className="h-10 w-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={infoForm.secondary_color}
                  onChange={(e) => setInfoForm(f => ({ ...f, secondary_color: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                />
              </div>
            </div>
            {/* Hosting Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Type d&apos;hebergement</label>
              <input
                type="text"
                value={infoForm.hosting_type}
                onChange={(e) => setInfoForm(f => ({ ...f, hosting_type: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                placeholder="ex: coolify, vercel, static..."
              />
            </div>
          </div>

          {/* Save button */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveInformations}
              disabled={saving}
              className="rounded-lg bg-[#F5A623] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#E09600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les informations'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ ONBOARDING TAB ═══════════ */}
      {activeTab === 'onboarding' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Donnees d&apos;onboarding</h2>
            {onboarding && (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>Etape: {onboarding.current_step}{onboarding.total_steps ? ` / ${onboarding.total_steps}` : ''}</span>
                {onboarding.generation_status && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    onboarding.generation_status === 'done' ? 'bg-green-50 text-green-600' :
                    onboarding.generation_status === 'error' ? 'bg-red-50 text-red-600' :
                    'bg-yellow-50 text-yellow-600'
                  }`}>
                    {onboarding.generation_status}
                  </span>
                )}
              </div>
            )}
          </div>

          {onboarding && Object.keys(onboardingAnswers).length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(onboardingAnswers).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-gray-50 p-4">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {key.replace(/_/g, ' ')}
                    </label>
                    {renderOnboardingField(key, value)}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={saveOnboarding}
                  disabled={saving}
                  className="rounded-lg bg-[#F5A623] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#E09600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer l\'onboarding'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300">
              <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
              <p className="text-sm text-gray-400">Aucune donnee d&apos;onboarding disponible.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ CONTENUS TAB ═══════════ */}
      {activeTab === 'content' && (
        <div>
          {contents.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
              <p className="text-sm text-gray-400">Aucun contenu genere pour ce site.</p>
              <a href="/content" className="mt-2 text-sm font-medium text-[#F5A623] hover:underline">Generer du contenu</a>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Titre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contents.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{item.title}</td>
                      <td className="px-4 py-3 text-gray-500">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{TYPE_LABELS[item.type] ?? item.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === 'published' ? 'bg-green-50 text-green-700' :
                          item.status === 'approved' ? 'bg-blue-50 text-blue-700' :
                          item.status === 'rejected' ? 'bg-red-50 text-red-700' :
                          'bg-yellow-50 text-yellow-700'
                        }`}>
                          {item.status === 'pending_validation' ? 'En attente' : item.status === 'approved' ? 'Approuve' : item.status === 'published' ? 'Publie' : item.status === 'rejected' ? 'Rejete' : item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ AVIS TAB ═══════════ */}
      {activeTab === 'reviews' && (
        <div>
          {reviews.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
              <p className="text-sm text-gray-400">Aucun avis Google pour ce site.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{review.author_name ?? 'Anonyme'}</span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-200'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    {new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ MODULES TAB ═══════════ */}
      {activeTab === 'modules' && (
        <div>
          {modules.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
              <p className="text-sm text-gray-400">Aucun module active pour ce site.</p>
              <a href="/modules" className="mt-2 text-sm font-medium text-[#F5A623] hover:underline">Activer des modules</a>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => {
                const isActive = mod.status === 'active'
                return (
                  <div
                    key={mod.id}
                    className={`rounded-xl border bg-white p-5 shadow-sm ${isActive ? 'border-[#F5A623] ring-1 ring-[#F5A623]/20' : 'border-gray-200'}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {mod.module_catalog?.name ?? mod.module_id}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    {mod.module_catalog?.category && (
                      <span className="text-xs text-gray-400">{mod.module_catalog.category}</span>
                    )}
                    {mod.activated_at && (
                      <p className="mt-2 text-xs text-gray-400">
                        Active le {new Date(mod.activated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ INTEGRATIONS TAB ═══════════ */}
      {activeTab === 'integrations' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">Integrations & Tracking</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Google Analytics ID</label>
              <input
                type="text"
                value={integrationsForm.google_analytics_id}
                onChange={(e) => setIntegrationsForm(f => ({ ...f, google_analytics_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                placeholder="G-XXXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Google Tag Manager ID</label>
              <input
                type="text"
                value={integrationsForm.google_tag_manager_id}
                onChange={(e) => setIntegrationsForm(f => ({ ...f, google_tag_manager_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                placeholder="GTM-XXXXXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Google Search Console</label>
              <input
                type="text"
                value={integrationsForm.google_search_console}
                onChange={(e) => setIntegrationsForm(f => ({ ...f, google_search_console: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                placeholder="URL ou code de verification"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Facebook Pixel ID</label>
              <input
                type="text"
                value={integrationsForm.facebook_pixel_id}
                onChange={(e) => setIntegrationsForm(f => ({ ...f, facebook_pixel_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                placeholder="XXXXXXXXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">GMB Location ID</label>
              <input
                type="text"
                value={integrationsForm.gmb_location_id}
                onChange={(e) => setIntegrationsForm(f => ({ ...f, gmb_location_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none"
                placeholder="locations/XXXXXXXXXXXX"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveIntegrations}
              disabled={saving}
              className="rounded-lg bg-[#F5A623] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#E09600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les integrations'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ PAGES CMS TAB ═══════════ */}
      {activeTab === 'cms' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">{pages.length} page{pages.length > 1 ? 's' : ''}</p>
            <button
              type="button"
              onClick={() => { setEditingPage(null); setPageForm({ title: '', slug: '', page_type: 'page', status: 'draft', show_in_nav: true, show_in_footer: false, meta_title: '', meta_description: '' }); setShowPageModal(true) }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F5A623] px-4 py-2 text-sm font-medium text-white hover:bg-[#E09600] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Ajouter une page
            </button>
          </div>

          {pages.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
              <p className="text-sm text-gray-400">Aucune page. Creez votre premiere page.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Page</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Slug</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Nav</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Sections</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pages.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.title}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell"><code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">/{p.slug}</code></td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{p.page_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'published' ? 'bg-green-50 text-green-700' : p.status === 'archived' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-50 text-yellow-700'}`}>
                          {p.status === 'published' ? 'Publie' : p.status === 'archived' ? 'Archive' : 'Brouillon'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {p.show_in_nav && <span className="text-xs text-green-600">Menu</span>}
                        {p.show_in_footer && <span className="ml-1 text-xs text-blue-600">Footer</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{Array.isArray(p.sections) ? p.sections.length : 0}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPage(p)
                              setPageForm({ title: p.title, slug: p.slug, page_type: p.page_type, status: p.status, show_in_nav: p.show_in_nav, show_in_footer: p.show_in_footer, meta_title: p.meta_title ?? '', meta_description: p.meta_description ?? '' })
                              setShowPageModal(true)
                            }}
                            className="rounded p-1.5 text-gray-400 hover:text-[#F5A623] hover:bg-[#F5A623]/10 transition-colors"
                            title="Modifier"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Supprimer la page "${p.title}" ?`)) return
                              await supabase.from('site_pages').delete().eq('id', p.id)
                              setPages(prev => prev.filter(x => x.id !== p.id))
                              showToast('Page supprimee', 'success')
                            }}
                            className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Page Modal */}
          {showPageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="mb-4 text-lg font-bold text-gray-900">{editingPage ? 'Modifier la page' : 'Nouvelle page'}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                    <input type="text" value={pageForm.title} onChange={(e) => { setPageForm(f => ({ ...f, title: e.target.value, slug: editingPage ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })) }} className={inputClassName} placeholder="Ma page" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                    <input type="text" value={pageForm.slug} onChange={(e) => setPageForm(f => ({ ...f, slug: e.target.value }))} className={inputClassName} placeholder="ma-page" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select value={pageForm.page_type} onChange={(e) => setPageForm(f => ({ ...f, page_type: e.target.value }))} className={inputClassName}>
                        <option value="page">Page</option>
                        <option value="blog_post">Article blog</option>
                        <option value="landing">Landing page</option>
                        <option value="legal">Page legale</option>
                        <option value="faq">FAQ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                      <select value={pageForm.status} onChange={(e) => setPageForm(f => ({ ...f, status: e.target.value }))} className={inputClassName}>
                        <option value="draft">Brouillon</option>
                        <option value="published">Publie</option>
                        <option value="archived">Archive</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta titre (SEO)</label>
                    <input type="text" value={pageForm.meta_title} onChange={(e) => setPageForm(f => ({ ...f, meta_title: e.target.value }))} className={inputClassName} placeholder="Titre SEO" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta description (SEO)</label>
                    <textarea value={pageForm.meta_description} onChange={(e) => setPageForm(f => ({ ...f, meta_description: e.target.value }))} className={inputClassName} rows={2} placeholder="Description pour les moteurs de recherche" />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={pageForm.show_in_nav} onChange={(e) => setPageForm(f => ({ ...f, show_in_nav: e.target.checked }))} className="accent-[#F5A623]" />
                      Afficher dans le menu
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={pageForm.show_in_footer} onChange={(e) => setPageForm(f => ({ ...f, show_in_footer: e.target.checked }))} className="accent-[#F5A623]" />
                      Afficher dans le footer
                    </label>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowPageModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Annuler</button>
                  <button
                    type="button"
                    disabled={saving || !pageForm.title || !pageForm.slug}
                    onClick={async () => {
                      setSaving(true)
                      if (editingPage) {
                        const { error } = await supabase.from('site_pages').update({
                          title: pageForm.title, slug: pageForm.slug, page_type: pageForm.page_type, status: pageForm.status,
                          show_in_nav: pageForm.show_in_nav, show_in_footer: pageForm.show_in_footer,
                          meta_title: pageForm.meta_title || null, meta_description: pageForm.meta_description || null,
                          published_at: pageForm.status === 'published' ? new Date().toISOString() : null,
                          updated_at: new Date().toISOString(),
                        }).eq('id', editingPage.id)
                        if (error) showToast('Erreur: ' + error.message, 'error')
                        else { showToast('Page mise a jour', 'success'); void loadData() }
                      } else {
                        const { error } = await supabase.from('site_pages').insert({
                          site_id: siteId, title: pageForm.title, slug: pageForm.slug, page_type: pageForm.page_type, status: pageForm.status,
                          show_in_nav: pageForm.show_in_nav, show_in_footer: pageForm.show_in_footer,
                          meta_title: pageForm.meta_title || null, meta_description: pageForm.meta_description || null,
                          sort_order: pages.length,
                          published_at: pageForm.status === 'published' ? new Date().toISOString() : null,
                        })
                        if (error) showToast('Erreur: ' + error.message, 'error')
                        else { showToast('Page creee', 'success'); void loadData() }
                      }
                      setSaving(false)
                      setShowPageModal(false)
                    }}
                    className="rounded-lg bg-[#F5A623] px-5 py-2 text-sm font-medium text-white hover:bg-[#E09600] disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Enregistrement...' : editingPage ? 'Mettre a jour' : 'Creer la page'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
