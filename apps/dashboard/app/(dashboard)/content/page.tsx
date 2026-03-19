'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../../../lib/api'
import { createBrowserClient } from '../../../lib/supabase'
import ContentCard from './components/ContentCard'
import ContentPreviewModal from './components/ContentPreviewModal'
import type { ContentItem, ContentStatus } from './components/ContentCard'

// ─── Tab definitions ─────────────────────────────────────────────
interface Tab {
  key: ContentStatus
  label: string
}

const TABS: Tab[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'scheduled', label: 'Planifies' },
  { key: 'published', label: 'Publies' },
  { key: 'rejected', label: 'Rejetes' },
]

interface ContentsResponse {
  data: ContentItem[]
  total: number
}

export default function ContentPage() {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ContentStatus>('pending')
  const [contents, setContents] = useState<ContentItem[]>([])
  const [counts, setCounts] = useState<Record<ContentStatus, number>>({
    pending: 0,
    scheduled: 0,
    published: 0,
    rejected: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<ContentItem | null>(null)

  // Resolve siteId from the current user
  useEffect(() => {
    async function resolveSite() {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (site?.id) setSiteId(site.id)
    }
    void resolveSite()
  }, [])

  // Fetch contents for active tab
  const fetchContents = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient<ContentsResponse>(
        `/api/v1/sites/${siteId}/contents?status=${activeTab}`,
      )
      setContents(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [siteId, activeTab])

  // Fetch counts for all tabs
  const fetchCounts = useCallback(async () => {
    if (!siteId) return
    try {
      const results = await Promise.all(
        TABS.map(async (tab) => {
          const res = await apiClient<ContentsResponse>(
            `/api/v1/sites/${siteId}/contents?status=${tab.key}&limit=0`,
          )
          return { key: tab.key, total: res.total }
        }),
      )
      const newCounts: Record<ContentStatus, number> = {
        pending: 0,
        scheduled: 0,
        published: 0,
        rejected: 0,
      }
      for (const r of results) {
        newCounts[r.key] = r.total
      }
      setCounts(newCounts)
    } catch {
      // counts are non-critical, silently fail
    }
  }, [siteId])

  useEffect(() => {
    void fetchContents()
  }, [fetchContents])

  useEffect(() => {
    void fetchCounts()
  }, [fetchCounts])

  // ─── Actions ─────────────────────────────────────────────────
  async function handleApprove(
    contentId: string,
    editedBody?: string,
    editedTitle?: string,
  ) {
    if (!siteId) return
    const payload: Record<string, unknown> = { status: 'scheduled' }
    if (editedBody !== undefined) payload.body = editedBody
    if (editedTitle !== undefined) payload.title = editedTitle

    await apiClient(`/api/v1/sites/${siteId}/contents/${contentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    await fetchContents()
    await fetchCounts()
  }

  async function handleReject(contentId: string, note?: string) {
    if (!siteId) return
    await apiClient(`/api/v1/sites/${siteId}/contents/${contentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', rejection_note: note }),
    })
    await fetchContents()
    await fetchCounts()
  }

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
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
                  activeTab === tab.key
                    ? 'bg-[#00D4B1] text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D4B1]" />
        </div>
      ) : contents.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
          <svg
            className="mb-3 h-10 w-10 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p className="text-sm text-gray-400">
            Aucun contenu {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contents.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              onPreview={setPreviewContent}
              onApprove={(id) => void handleApprove(id)}
              onReject={(id) => void handleReject(id)}
            />
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewContent && (
        <ContentPreviewModal
          content={previewContent}
          onClose={() => setPreviewContent(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
