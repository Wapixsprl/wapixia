'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PexelsPhoto {
  id: number
  width: number
  height: number
  photographer: string
  url: string
  src: {
    medium: string
    large2x: string
    original: string
  }
}

interface PexelsResponse {
  photos: PexelsPhoto[]
  page: number
  per_page: number
  total_results: number
  next_page?: string
}

interface ImagePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (imageUrl: string, photographer: string, pexelsUrl: string) => void
}

// ---------------------------------------------------------------------------
// ImagePicker Modal
// ---------------------------------------------------------------------------

export default function ImagePicker({ isOpen, onClose, onSelect }: ImagePickerProps) {
  const [query, setQuery] = useState('')
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [page, setPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const API_KEY = process.env.NEXT_PUBLIC_PEXELS_API_KEY || ''

  // -----------------------------------------------------------------------
  // Fetch helpers
  // -----------------------------------------------------------------------

  const fetchPhotos = useCallback(
    async (searchQuery: string, pageNum: number, append = false) => {
      if (!API_KEY) return
      if (append) setLoadingMore(true)
      else setLoading(true)

      try {
        const url = searchQuery.trim()
          ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery.trim())}&per_page=30&page=${pageNum}`
          : `https://api.pexels.com/v1/curated?per_page=30&page=${pageNum}`

        const res = await fetch(url, {
          headers: { Authorization: API_KEY },
        })

        if (!res.ok) throw new Error('Pexels API error')

        const data: PexelsResponse = await res.json()
        setPhotos((prev) => (append ? [...prev, ...data.photos] : data.photos))
        setTotalResults(data.total_results)
        setPage(pageNum)
      } catch {
        // silently fail – user can retry
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [API_KEY],
  )

  // Load curated on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setPhotos([])
      setSelectedId(null)
      setPage(1)
      fetchPhotos('', 1)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, fetchPhotos])

  // Debounced search
  useEffect(() => {
    if (!isOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchPhotos(query, 1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleLoadMore = () => {
    fetchPhotos(query, page + 1, true)
  }

  const handleSelect = (photo: PexelsPhoto) => {
    setSelectedId(photo.id)
    onSelect(photo.src.large2x, photo.photographer, photo.url)
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!isOpen) return null

  const hasMore = photos.length < totalResults

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F5A623]/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Banque d&apos;images</h2>
                <p className="text-xs text-gray-400">Recherchez parmi des millions de photos libres de droits</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher des images... (ex: nature, bureau, restaurant)"
              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5A623]/50 focus:border-[#F5A623] transition-all"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-4">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-[#F5A623] rounded-full animate-spin" />
              <p className="mt-4 text-sm text-gray-400">Chargement des images...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && photos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune image trouvee</p>
              <p className="text-xs text-gray-400 mt-1">Essayez un autre terme de recherche</p>
            </div>
          )}

          {/* Image grid */}
          {!loading && photos.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => handleSelect(photo)}
                    className={`group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 hover:ring-2 ring-[#F5A623] focus:outline-none focus:ring-2 focus:ring-[#F5A623] ${
                      selectedId === photo.id ? 'ring-2 ring-[#F5A623] scale-105' : ''
                    }`}
                  >
                    <img
                      src={photo.src.medium}
                      alt={`Photo by ${photo.photographer}`}
                      className="w-full h-40 object-cover"
                      loading="lazy"
                    />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2">
                      <p className="text-white text-xs font-medium truncate">{photo.photographer}</p>
                      <p className="text-white/70 text-[10px]">{photo.width} x {photo.height}</p>
                    </div>

                    {/* Selected checkmark */}
                    {selectedId === photo.id && (
                      <div className="absolute inset-0 bg-[#F5A623]/20 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#F5A623] flex items-center justify-center shadow-lg">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-[#F5A623] rounded-full animate-spin" />
                        Chargement...
                      </>
                    ) : (
                      'Charger plus'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer attribution */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-center">
          <p className="text-xs text-gray-400">
            Photos fournies par{' '}
            <a
              href="https://www.pexels.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F5A623] hover:underline font-medium"
            >
              Pexels
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
