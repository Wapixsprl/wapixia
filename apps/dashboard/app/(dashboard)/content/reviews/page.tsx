'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../../../../lib/api'
import { createBrowserClient } from '../../../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────
type ReviewStatus = 'pending' | 'generated' | 'published' | 'ignored'

interface Review {
  id: string
  author_name: string
  rating: number
  comment: string
  review_date: string
  status: ReviewStatus
  generated_reply?: string
  site_id: string
}

interface ReviewsResponse {
  data: Review[]
  total: number
}

// ─── Status config ───────────────────────────────────────────────
const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; color: string; bg: string }
> = {
  pending: { label: 'En attente', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  generated: { label: 'Generee', color: 'text-blue-700', bg: 'bg-blue-100' },
  published: { label: 'Publiee', color: 'text-green-700', bg: 'bg-green-100' },
  ignored: { label: 'Ignoree', color: 'text-gray-500', bg: 'bg-gray-100' },
}

// ─── Star rating component ───────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [editingReply, setEditingReply] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Resolve siteId
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

  const fetchReviews = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient<ReviewsResponse>(
        `/api/v1/sites/${siteId}/reviews`,
      )
      setReviews(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    void fetchReviews()
  }, [fetchReviews])

  // ─── Actions ─────────────────────────────────────────────────
  function openReview(review: Review) {
    setSelectedReview(review)
    setEditingReply(review.generated_reply ?? '')
  }

  async function handlePublish(reviewId: string) {
    if (!siteId) return
    setSubmitting(true)
    try {
      await apiClient(`/api/v1/sites/${siteId}/reviews/${reviewId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ reply: editingReply }),
      })
      setSelectedReview(null)
      await fetchReviews()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de publication')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleIgnore(reviewId: string) {
    if (!siteId) return
    setSubmitting(true)
    try {
      await apiClient(`/api/v1/sites/${siteId}/reviews/${reviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ignored' }),
      })
      setSelectedReview(null)
      await fetchReviews()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Avis Google</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerez les avis et les reponses generees par l&apos;IA.
        </p>
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
      ) : reviews.length === 0 ? (
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
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
          <p className="text-sm text-gray-400">Aucun avis pour le moment</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Table header - desktop */}
          <div className="hidden border-b border-gray-100 bg-gray-50 px-6 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
            <span className="col-span-1 text-xs font-medium uppercase tracking-wider text-gray-400">
              Note
            </span>
            <span className="col-span-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Auteur
            </span>
            <span className="col-span-5 text-xs font-medium uppercase tracking-wider text-gray-400">
              Commentaire
            </span>
            <span className="col-span-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Date
            </span>
            <span className="col-span-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Statut
            </span>
          </div>

          {/* Rows */}
          {reviews.map((review) => {
            const isNegative = review.rating <= 2
            return (
              <button
                key={review.id}
                type="button"
                onClick={() => openReview(review)}
                className={`block w-full border-b border-gray-50 px-6 py-4 text-left transition-colors hover:bg-gray-50 ${
                  isNegative ? 'bg-red-50/50' : ''
                }`}
              >
                {/* Mobile view */}
                <div className="sm:hidden">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} />
                      <span className="text-sm font-medium text-gray-900">
                        {review.author_name}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[review.status].bg} ${STATUS_CONFIG[review.status].color}`}
                    >
                      {STATUS_CONFIG[review.status].label}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-gray-600">
                    {review.comment}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(review.review_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {/* Desktop view */}
                <div className="hidden sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
                  <div className="col-span-1">
                    <StarRating rating={review.rating} />
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-gray-900">
                      {review.author_name}
                    </span>
                  </div>
                  <div className="col-span-5">
                    <p className="line-clamp-2 text-sm text-gray-600">
                      {review.comment}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm text-gray-400">
                      {new Date(review.review_date).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[review.status].bg} ${STATUS_CONFIG[review.status].color}`}
                    >
                      {STATUS_CONFIG[review.status].label}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Review detail modal */}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          editingReply={editingReply}
          onEditReply={setEditingReply}
          onPublish={() => void handlePublish(selectedReview.id)}
          onIgnore={() => void handleIgnore(selectedReview.id)}
          onClose={() => setSelectedReview(null)}
          submitting={submitting}
        />
      )}
    </div>
  )
}

// ─── Review detail modal ─────────────────────────────────────────
function ReviewDetailModal({
  review,
  editingReply,
  onEditReply,
  onPublish,
  onIgnore,
  onClose,
  submitting,
}: {
  review: Review
  editingReply: string
  onEditReply: (v: string) => void
  onPublish: () => void
  onIgnore: () => void
  onClose: () => void
  submitting: boolean
}) {
  const isNegative = review.rating <= 2

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Detail de l&apos;avis</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Review info */}
          <div
            className={`mb-4 rounded-lg p-4 ${isNegative ? 'border border-red-200 bg-red-50' : 'bg-gray-50'}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {review.author_name}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(review.review_date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <StarRating rating={review.rating} />
            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
              {review.comment}
            </p>
          </div>

          {/* Generated reply */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Reponse generee
            </label>
            <textarea
              value={editingReply}
              onChange={(e) => onEditReply(e.target.value)}
              className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-700 focus:border-[#00D4B1] focus:outline-none focus:ring-1 focus:ring-[#00D4B1]"
              rows={5}
              placeholder="Aucune reponse generee..."
            />
          </div>
        </div>

        {/* Actions */}
        {(review.status === 'pending' || review.status === 'generated') && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onIgnore}
              disabled={submitting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Ignorer
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={submitting || !editingReply.trim()}
              className="rounded-lg bg-[#00D4B1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#00BFA0] disabled:opacity-50"
            >
              {submitting ? 'Publication...' : 'Publier la reponse'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
