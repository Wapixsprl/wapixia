'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '../../../../lib/supabase'

interface Review {
  id: string
  author_name: string
  rating: number
  comment: string
  review_date: string
  reply_status: string
  reply_content: string | null
  is_negative: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  generated: { label: 'Reponse IA', color: 'text-blue-700', bg: 'bg-blue-100' },
  published: { label: 'Publiee', color: 'text-green-700', bg: 'bg-green-100' },
  ignored: { label: 'Ignoree', color: 'text-gray-500', bg: 'bg-gray-100' },
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} className={`h-4 w-4 ${i < rating ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
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
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [editingReply, setEditingReply] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    async function resolveSite() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: site } = await supabase.from('sites').select('id').eq('owner_user_id', user.id).single()
      if (site?.id) setSiteId(site.id)
      else {
        const { data: first } = await supabase.from('sites').select('id').limit(1).single()
        if (first?.id) setSiteId(first.id)
      }
    }
    void resolveSite()
  }, [supabase])

  const fetchReviews = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    const { data } = await supabase
      .from('google_reviews')
      .select('*')
      .eq('site_id', siteId)
      .order('review_date', { ascending: false })
    if (data) setReviews(data)
    setLoading(false)
  }, [siteId, supabase])

  useEffect(() => { void fetchReviews() }, [fetchReviews])

  async function handlePublishReply(reviewId: string) {
    setSubmitting(true)
    await supabase.from('google_reviews').update({
      reply_content: editingReply,
      reply_status: 'published',
      published_at: new Date().toISOString()
    }).eq('id', reviewId)
    setSelectedReview(null)
    await fetchReviews()
    setSubmitting(false)
  }

  async function handleIgnore(reviewId: string) {
    setSubmitting(true)
    await supabase.from('google_reviews').update({ reply_status: 'ignored' }).eq('id', reviewId)
    setSelectedReview(null)
    await fetchReviews()
    setSubmitting(false)
  }

  // Stats
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0'
  const pendingCount = reviews.filter(r => r.reply_status === 'pending' || r.reply_status === 'generated').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Avis Google</h1>
        <p className="mt-1 text-sm text-gray-500">Gerez les avis et les reponses generees par l&apos;IA.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#F5A623]">{reviews.length}</p>
          <p className="text-xs text-gray-500">Total avis</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-gray-900">{avgRating} <span className="text-sm text-yellow-400">&#9733;</span></p>
          <p className="text-xs text-gray-500">Note moyenne</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-orange-500">{pendingCount}</p>
          <p className="text-xs text-gray-500">A traiter</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
          <p className="text-sm text-gray-400">Aucun avis pour le moment</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {reviews.map((review) => {
            const cfg = STATUS_CONFIG[review.reply_status] ?? STATUS_CONFIG.pending
            return (
              <button
                key={review.id}
                type="button"
                onClick={() => { setSelectedReview(review); setEditingReply(review.reply_content ?? '') }}
                className={`block w-full border-b border-gray-50 px-6 py-4 text-left transition-colors hover:bg-gray-50 ${review.rating <= 2 ? 'bg-red-50/50' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5A623]/10 text-sm font-bold text-[#F5A623]">
                      {review.author_name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{review.author_name}</span>
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.rating} />
                        <span className="text-xs text-gray-400">
                          {new Date(review.review_date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-gray-600 ml-11">{review.comment}</p>
                {review.reply_content && (
                  <p className="mt-2 ml-11 text-xs text-blue-600 line-clamp-1">
                    &#8627; {review.reply_content}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedReview(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Detail de l&apos;avis</h2>
              <button type="button" onClick={() => setSelectedReview(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className={`mb-4 rounded-lg p-4 ${selectedReview.rating <= 2 ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{selectedReview.author_name}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(selectedReview.review_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <StarRating rating={selectedReview.rating} />
                <p className="mt-3 text-sm text-gray-700">{selectedReview.comment}</p>
              </div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Reponse</label>
              <textarea
                value={editingReply}
                onChange={(e) => setEditingReply(e.target.value)}
                className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
                rows={4}
                placeholder="Ecrivez votre reponse..."
              />
            </div>
            {(selectedReview.reply_status === 'pending' || selectedReview.reply_status === 'generated') && (
              <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
                <button type="button" onClick={() => void handleIgnore(selectedReview.id)} disabled={submitting}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  Ignorer
                </button>
                <button type="button" onClick={() => void handlePublishReply(selectedReview.id)} disabled={submitting || !editingReply.trim()}
                  className="rounded-lg bg-[#F5A623] px-4 py-2 text-sm font-medium text-white hover:bg-[#E09600] disabled:opacity-50">
                  {submitting ? 'Publication...' : 'Publier la reponse'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
