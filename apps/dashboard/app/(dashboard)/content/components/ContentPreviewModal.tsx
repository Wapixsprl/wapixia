'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ContentItem, ContentType } from './ContentCard'

interface ContentPreviewModalProps {
  content: ContentItem
  onClose: () => void
  onApprove: (contentId: string, editedBody?: string, editedTitle?: string) => Promise<void>
  onReject: (contentId: string, note?: string) => Promise<void>
}

export default function ContentPreviewModal({
  content,
  onClose,
  onApprove,
  onReject,
}: ContentPreviewModalProps) {
  const [editedBody, setEditedBody] = useState(content.body)
  const [editedTitle, setEditedTitle] = useState(content.title ?? '')
  const [rejectionNote, setRejectionNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isModified =
    editedBody !== content.body || editedTitle !== (content.title ?? '')

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleApprove = useCallback(async () => {
    setSubmitting(true)
    try {
      if (isModified) {
        await onApprove(content.id, editedBody, editedTitle || undefined)
      } else {
        await onApprove(content.id)
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }, [content.id, editedBody, editedTitle, isModified, onApprove, onClose])

  const handleReject = useCallback(async () => {
    setSubmitting(true)
    try {
      await onReject(content.id, rejectionNote || undefined)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }, [content.id, rejectionNote, onReject, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Apercu du contenu
          </h2>
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
          <PlatformPreview
            type={content.type}
            title={editedTitle}
            body={editedBody}
            visualUrl={content.visual_url}
            onTitleChange={setEditedTitle}
            onBodyChange={setEditedBody}
            editable={content.status === 'pending'}
          />

          {/* Rejection form */}
          {showRejectForm && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <label className="mb-2 block text-sm font-medium text-red-700">
                Note de rejet (optionnel)
              </label>
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Expliquez pourquoi ce contenu est rejete..."
                className="w-full rounded-lg border border-red-200 bg-white p-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                rows={3}
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleReject()}
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? 'Envoi...' : 'Confirmer le rejet'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {content.status === 'pending' && !showRejectForm && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Rejeter
            </button>
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={submitting}
              className="rounded-lg bg-[#00D4B1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#00BFA0] disabled:opacity-50"
            >
              {submitting
                ? 'Approbation...'
                : isModified
                  ? 'Approuver avec modifications'
                  : 'Approuver tel quel'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Platform-specific preview rendering ─────────────────────────

interface PlatformPreviewProps {
  type: ContentType
  title: string
  body: string
  visualUrl?: string
  onTitleChange: (v: string) => void
  onBodyChange: (v: string) => void
  editable: boolean
}

function PlatformPreview({
  type,
  title,
  body,
  visualUrl,
  onTitleChange,
  onBodyChange,
  editable,
}: PlatformPreviewProps) {
  switch (type) {
    case 'post_fb':
      return (
        <FacebookPreview
          body={body}
          visualUrl={visualUrl}
          onBodyChange={onBodyChange}
          editable={editable}
        />
      )
    case 'post_ig':
      return (
        <InstagramPreview
          body={body}
          visualUrl={visualUrl}
          onBodyChange={onBodyChange}
          editable={editable}
        />
      )
    case 'blog':
      return (
        <BlogPreview
          title={title}
          body={body}
          onTitleChange={onTitleChange}
          onBodyChange={onBodyChange}
          editable={editable}
        />
      )
    default:
      return (
        <GenericPreview
          body={body}
          visualUrl={visualUrl}
          onBodyChange={onBodyChange}
          editable={editable}
        />
      )
  }
}

// ─── Facebook card style ─────────────────────────────────────────
function FacebookPreview({
  body,
  visualUrl,
  onBodyChange,
  editable,
}: {
  body: string
  visualUrl?: string
  onBodyChange: (v: string) => void
  editable: boolean
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 bg-white p-4">
        <div className="h-10 w-10 rounded-full bg-blue-500" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Page Facebook</p>
          <p className="text-xs text-gray-400">Publication sponsorisee</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        {editable ? (
          <textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            className="w-full resize-none rounded border border-transparent p-1 text-sm text-gray-800 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            rows={4}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-gray-800">{body}</p>
        )}
      </div>
      {visualUrl && (
        <img src={visualUrl} alt="" className="w-full object-cover" />
      )}
      <div className="flex items-center gap-6 border-t border-gray-100 px-4 py-2">
        <span className="text-xs text-gray-400">J&apos;aime</span>
        <span className="text-xs text-gray-400">Commenter</span>
        <span className="text-xs text-gray-400">Partager</span>
      </div>
    </div>
  )
}

// ─── Instagram square + caption ──────────────────────────────────
function InstagramPreview({
  body,
  visualUrl,
  onBodyChange,
  editable,
}: {
  body: string
  visualUrl?: string
  onBodyChange: (v: string) => void
  editable: boolean
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
        <p className="text-sm font-semibold text-gray-900">compte_instagram</p>
      </div>
      {visualUrl ? (
        <div className="aspect-square w-full overflow-hidden bg-gray-100">
          <img src={visualUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-gray-100">
          <span className="text-sm text-gray-400">Aucun visuel</span>
        </div>
      )}
      <div className="p-4">
        {editable ? (
          <textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            className="w-full resize-none rounded border border-transparent p-1 text-sm text-gray-800 focus:border-pink-300 focus:outline-none focus:ring-1 focus:ring-pink-300"
            rows={4}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-gray-800">{body}</p>
        )}
      </div>
    </div>
  )
}

// ─── Blog article preview ────────────────────────────────────────
function BlogPreview({
  title,
  body,
  onTitleChange,
  onBodyChange,
  editable,
}: {
  title: string
  body: string
  onTitleChange: (v: string) => void
  onBodyChange: (v: string) => void
  editable: boolean
}) {
  return (
    <div className="space-y-4">
      {editable ? (
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full rounded border border-gray-200 px-3 py-2 text-xl font-bold text-gray-900 focus:border-[#00D4B1] focus:outline-none focus:ring-1 focus:ring-[#00D4B1]"
          placeholder="Titre de l'article"
        />
      ) : (
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      )}

      {editable ? (
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          className="w-full resize-none rounded border border-gray-200 p-3 text-sm leading-relaxed text-gray-700 focus:border-[#00D4B1] focus:outline-none focus:ring-1 focus:ring-[#00D4B1]"
          rows={12}
        />
      ) : (
        <div className="prose prose-sm max-w-none text-gray-700">
          <p className="whitespace-pre-wrap">{body}</p>
        </div>
      )}
    </div>
  )
}

// ─── Generic preview (GMB, Avis, etc.) ───────────────────────────
function GenericPreview({
  body,
  visualUrl,
  onBodyChange,
  editable,
}: {
  body: string
  visualUrl?: string
  onBodyChange: (v: string) => void
  editable: boolean
}) {
  return (
    <div className="space-y-4">
      {visualUrl && (
        <div className="overflow-hidden rounded-lg">
          <img src={visualUrl} alt="" className="w-full object-cover" />
        </div>
      )}
      {editable ? (
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          className="w-full resize-none rounded border border-gray-200 p-3 text-sm text-gray-700 focus:border-[#00D4B1] focus:outline-none focus:ring-1 focus:ring-[#00D4B1]"
          rows={6}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-gray-700">{body}</p>
      )}
    </div>
  )
}
