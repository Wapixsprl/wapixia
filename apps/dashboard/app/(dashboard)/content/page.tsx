'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '../../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────
type ContentStatus = 'pending_validation' | 'approved' | 'published' | 'rejected'

interface ContentItem {
  id: string
  type: string
  title: string
  content: string
  excerpt: string | null
  status: string
  module_id: string
  created_at: string
}

interface Tab {
  key: ContentStatus
  label: string
  dbValues: string[] // map to DB enum values
}

const TABS: Tab[] = [
  { key: 'pending_validation', label: 'En attente', dbValues: ['pending_validation'] },
  { key: 'approved', label: 'Planifies', dbValues: ['approved', 'auto_approved'] },
  { key: 'published', label: 'Publies', dbValues: ['published'] },
  { key: 'rejected', label: 'Rejetes', dbValues: ['rejected'] },
]

const TYPE_LABELS: Record<string, string> = {
  blog_article: 'Article Blog',
  social_post: 'Post Social',
  gmb_post: 'Post GMB',
  review_reply: 'Reponse Avis',
  seo_meta: 'SEO Meta',
  faq: 'FAQ',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending_validation: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
  auto_approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
  published: { bg: 'bg-green-100', text: 'text-green-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
}

export default function ContentPage() {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ContentStatus>('pending_validation')
  const [contents, setContents] = useState<ContentItem[]>([])
  const [counts, setCounts] = useState<Record<ContentStatus, number>>({
    pending_validation: 0,
    approved: 0,
    published: 0,
    rejected: 0,
  })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const supabase = createBrowserClient()

  // Resolve siteId
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
        // superadmin: get first site
        const { data: firstSite } = await supabase.from('sites').select('id').limit(1).single()
        if (firstSite?.id) setSiteId(firstSite.id)
      }
    }
    void resolveSite()
  }, [supabase])

  // Fetch contents
  const fetchContents = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    const tab = TABS.find(t => t.key === activeTab)!
    const { data, error } = await supabase
      .from('ai_contents')
      .select('*')
      .eq('site_id', siteId)
      .in('status', tab.dbValues)
      .order('created_at', { ascending: false })
    if (!error && data) setContents(data)
    setLoading(false)
  }, [siteId, activeTab, supabase])

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    if (!siteId) return
    const newCounts: Record<ContentStatus, number> = { pending_validation: 0, approved: 0, published: 0, rejected: 0 }
    for (const tab of TABS) {
      const { count } = await supabase
        .from('ai_contents')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .in('status', tab.dbValues)
      newCounts[tab.key] = count ?? 0
    }
    setCounts(newCounts)
  }, [siteId, supabase])

  useEffect(() => { void fetchContents() }, [fetchContents])
  useEffect(() => { void fetchCounts() }, [fetchCounts])

  // Actions
  async function handleApprove(contentId: string) {
    setActionLoading(contentId)
    await supabase.from('ai_contents').update({ status: 'approved' }).eq('id', contentId)
    await fetchContents()
    await fetchCounts()
    setActionLoading(null)
  }

  async function handleReject(contentId: string) {
    setActionLoading(contentId)
    await supabase.from('ai_contents').update({ status: 'rejected' }).eq('id', contentId)
    await fetchContents()
    await fetchCounts()
    setActionLoading(null)
  }

  async function handlePublish(contentId: string) {
    setActionLoading(contentId)
    await supabase.from('ai_contents').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', contentId)
    await fetchContents()
    await fetchCounts()
    setActionLoading(null)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contenus</h1>
        <p className="mt-1 text-sm text-gray-500">
          Validez, planifiez ou rejetez les contenus generes par l&apos;IA.
        </p>
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
            {counts[tab.key] > 0 && (
              <span
                className={`ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  activeTab === tab.key ? 'bg-[#F5A623] text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
        </div>
      ) : contents.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
          <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm text-gray-400">
            Aucun contenu {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contents.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]?.bg ?? 'bg-gray-100'} ${STATUS_COLORS[item.status]?.text ?? 'text-gray-600'}`}>
                  {item.status === 'pending_validation' ? 'En attente' : item.status === 'approved' ? 'Approuve' : item.status === 'published' ? 'Publie' : 'Rejete'}
                </span>
              </div>

              {/* Title */}
              <h3 className="mb-2 text-sm font-semibold text-gray-900 line-clamp-2">{item.title}</h3>

              {/* Excerpt */}
              <p className="mb-4 text-xs text-gray-500 line-clamp-3">
                {item.excerpt ?? item.content?.substring(0, 120) + '...'}
              </p>

              {/* Date */}
              <p className="mb-3 text-xs text-gray-400">
                {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                {item.status === 'pending_validation' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleApprove(item.id)}
                      disabled={actionLoading === item.id}
                      className="flex-1 rounded-lg bg-[#F5A623] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#E09600] disabled:opacity-50 transition-colors"
                    >
                      Approuver
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReject(item.id)}
                      disabled={actionLoading === item.id}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Rejeter
                    </button>
                  </>
                )}
                {item.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => void handlePublish(item.id)}
                    disabled={actionLoading === item.id}
                    className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    Publier
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
