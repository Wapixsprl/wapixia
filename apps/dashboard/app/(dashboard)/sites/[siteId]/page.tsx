'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '../../../../lib/supabase'

interface SiteData {
  id: string
  name: string
  domain: string | null
  status: string
  sector: string | null
  onboarding_done: boolean
  visibility_score: number | null
  organization_id: string | null
  created_at: string
}

interface Organization {
  id: string
  name: string
}

interface OnboardingSession {
  id: string
  answers: Record<string, unknown>
  current_step: number
  completed_at: string | null
  created_at: string
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

type TabKey = 'overview' | 'content' | 'reviews' | 'modules'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  setup: { label: 'En configuration', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  staging: { label: 'En test', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  live: { label: 'En ligne', color: 'bg-green-50 text-green-700 border-green-200' },
  suspended: { label: 'Suspendu', color: 'bg-red-50 text-red-700 border-red-200' },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Vue d\'ensemble' },
  { key: 'content', label: 'Contenus' },
  { key: 'reviews', label: 'Avis' },
  { key: 'modules', label: 'Modules' },
]

const TYPE_LABELS: Record<string, string> = {
  blog_article: 'Article Blog',
  social_post: 'Post Social',
  gmb_post: 'Post GMB',
  review_reply: 'Reponse Avis',
  seo_meta: 'SEO Meta',
  faq: 'FAQ',
}

export default function SiteDetailPage() {
  const params = useParams()
  const siteId = params.siteId as string

  const [site, setSite] = useState<SiteData | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingSession | null>(null)
  const [contents, setContents] = useState<ContentItem[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [modules, setModules] = useState<SiteModule[]>([])
  const [stats, setStats] = useState({ contentCount: 0, reviewCount: 0, activeModules: 0, avgRating: '0' })
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

  const loadData = useCallback(async () => {
    if (!siteId) return
    setLoading(true)

    // Fetch site
    const { data: siteData } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single()

    if (!siteData) { setLoading(false); return }
    setSite(siteData)

    // Fetch org, onboarding, contents, reviews, modules in parallel
    const [orgRes, onbRes, contentsRes, reviewsRes, modulesRes, contentCountRes, activeModRes] = await Promise.all([
      siteData.organization_id
        ? supabase.from('organizations').select('id, name').eq('id', siteData.organization_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('onboarding_sessions').select('*').eq('site_id', siteId).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('ai_contents').select('id, type, title, status, created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(20),
      supabase.from('google_reviews').select('id, author_name, rating, comment, created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(20),
      supabase.from('site_modules').select('id, module_id, status, activated_at, module_catalog(name, category)').eq('site_id', siteId),
      supabase.from('ai_contents').select('*', { count: 'exact', head: true }).eq('site_id', siteId),
      supabase.from('site_modules').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'active'),
    ])

    if (orgRes.data) setOrg(orgRes.data)
    if (onbRes.data) setOnboarding(onbRes.data)
    if (contentsRes.data) setContents(contentsRes.data)
    if (reviewsRes.data) setReviews(reviewsRes.data)
    if (modulesRes.data) setModules(modulesRes.data as unknown as SiteModule[])

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

  return (
    <div>
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
            {site.domain && <span>{site.domain}</span>}
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

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Site Info */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations du site</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nom</dt>
                <dd className="mt-1 text-sm text-gray-900">{site.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Domaine</dt>
                <dd className="mt-1 text-sm text-gray-900">{site.domain ?? 'Non defini'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Statut</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Organisation</dt>
                <dd className="mt-1 text-sm text-gray-900">{org?.name ?? 'Aucune'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Secteur</dt>
                <dd className="mt-1 text-sm text-gray-900">{site.sector ?? 'Non defini'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Onboarding</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${site.onboarding_done ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                    {site.onboarding_done ? 'Termine' : 'En cours'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Date de creation</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(site.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Onboarding Data */}
          {onboarding && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Donnees d&apos;onboarding</h2>
              <div className="mb-3 flex items-center gap-3 text-sm text-gray-500">
                <span>Etape actuelle: {onboarding.current_step}</span>
                {onboarding.completed_at && (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                    Termine le {new Date(onboarding.completed_at).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
              {onboarding.answers && Object.keys(onboarding.answers).length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(onboarding.answers).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-gray-50 p-3">
                      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{key.replace(/_/g, ' ')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 break-words">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </dd>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aucune donnee d&apos;onboarding disponible.</p>
              )}
            </div>
          )}
        </div>
      )}

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
    </div>
  )
}
