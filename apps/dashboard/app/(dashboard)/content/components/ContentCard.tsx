'use client'

import { useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────
export type ContentType = 'blog' | 'post_fb' | 'post_ig' | 'gmb' | 'avis'
export type ContentStatus = 'pending' | 'scheduled' | 'published' | 'rejected'

export interface ContentItem {
  id: string
  type: ContentType
  title?: string
  body: string
  visual_url?: string
  scheduled_at?: string
  status: ContentStatus
  site_id: string
  created_at: string
}

// ─── Platform config ─────────────────────────────────────────────
const TYPE_CONFIG: Record<
  ContentType,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  blog: {
    label: 'Blog',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  },
  post_fb: {
    label: 'Post FB',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
  },
  post_ig: {
    label: 'Post IG',
    color: 'text-pink-700',
    bgColor: 'bg-gradient-to-br from-purple-100 to-pink-100',
    icon: 'M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01M6.5 2h11A4.5 4.5 0 0122 6.5v11a4.5 4.5 0 01-4.5 4.5h-11A4.5 4.5 0 012 17.5v-11A4.5 4.5 0 016.5 2z',
  },
  gmb: {
    label: 'GMB',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  },
  avis: {
    label: 'Avis',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  },
}

// ─── Props ───────────────────────────────────────────────────────
interface ContentCardProps {
  content: ContentItem
  onPreview: (content: ContentItem) => void
  onApprove: (contentId: string) => void
  onReject: (contentId: string) => void
}

export default function ContentCard({
  content,
  onPreview,
  onApprove,
  onReject,
}: ContentCardProps) {
  const [acting, setActing] = useState<'approve' | 'reject' | null>(null)
  const cfg = TYPE_CONFIG[content.type]

  const excerpt =
    content.body.length > 160
      ? content.body.slice(0, 160) + '...'
      : content.body

  const scheduledLabel = content.scheduled_at
    ? new Date(content.scheduled_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  async function handleApprove() {
    setActing('approve')
    try {
      await onApprove(content.id)
    } finally {
      setActing(null)
    }
  }

  async function handleReject() {
    setActing('reject')
    try {
      await onReject(content.id)
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Image thumbnail */}
      {content.visual_url && (
        <div className="relative h-40 w-full overflow-hidden bg-gray-100">
          <img
            src={content.visual_url}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* Header: badge + date */}
        <div className="mb-2 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.color}`}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
            </svg>
            {cfg.label}
          </span>

          {scheduledLabel && (
            <span className="text-xs text-gray-400">{scheduledLabel}</span>
          )}
        </div>

        {/* Title */}
        {content.title && (
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            {content.title}
          </h3>
        )}

        {/* Excerpt (3 lines max) */}
        <p className="mb-4 line-clamp-3 flex-1 text-sm text-gray-600">
          {excerpt}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => onPreview(content)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Apercu
          </button>

          {content.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={acting !== null}
                className="rounded-lg bg-[#00D4B1] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#00BFA0] disabled:opacity-50"
              >
                {acting === 'approve' ? 'Approbation...' : 'Approuver'}
              </button>
              <button
                type="button"
                onClick={() => void handleReject()}
                disabled={acting !== null}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {acting === 'reject' ? 'Rejet...' : 'Rejeter'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
