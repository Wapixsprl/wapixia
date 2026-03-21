'use client'

import { useCallback, useState } from 'react'
import { createBrowserClient } from '../../../../../lib/supabase'
import { type StepProps, LANGUAGES, TONES } from '../../types'

interface FileItem {
  name: string
  size: number
  path: string
  type: string
}

const ACCEPTED_TYPES = 'image/*,.pdf,.doc,.docx,.ppt,.pptx'

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf'].includes(ext)) return 'PDF'
  if (['doc', 'docx'].includes(ext)) return 'DOC'
  if (['ppt', 'pptx'].includes(ext)) return 'PPT'
  return 'IMG'
}

function Step14({ answers, onUpdate }: StepProps) {
  const files = (answers.uploaded_files as FileItem[]) ?? []
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadFiles = useCallback(
    async (rawFiles: File[]) => {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUploading(true)
      setUploadError(null)
      const newItems: FileItem[] = []

      for (const f of rawFiles) {
        if (files.length + newItems.length >= 10) break
        if (f.size > 10 * 1024 * 1024) { setUploadError('Fichier trop volumineux (max 10 Mo)'); continue }

        const ext = f.name.split('.').pop() ?? 'bin'
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error } = await supabase.storage
          .from('onboarding-files')
          .upload(path, f, { upsert: false })

        if (error) {
          setUploadError(`Erreur: ${error.message}`)
          continue
        }

        newItems.push({ name: f.name, size: f.size, path, type: f.type })
      }

      if (newItems.length > 0) {
        onUpdate('uploaded_files', [...files, ...newItems])
      }
      setUploading(false)
    },
    [files, onUpdate],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      void uploadFiles(Array.from(e.dataTransfer.files))
    },
    [uploadFiles],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void uploadFiles(Array.from(e.target.files ?? []))
      e.target.value = ''
    },
    [uploadFiles],
  )

  async function removeFile(index: number) {
    const file = files[index]
    if (file?.path) {
      const supabase = createBrowserClient()
      await supabase.storage.from('onboarding-files').remove([file.path])
    }
    onUpdate('uploaded_files', files.filter((_, i) => i !== index))
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Photos, visuels et documents de presentation
      </label>
      <p className="text-xs text-gray-400">
        Ajoutez vos photos, logos, presentations (PDF, PowerPoint, Word) pour personnaliser votre site.
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? 'border-[#F5A623] bg-[#F5A623]/5'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {uploading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#F5A623]" />
            <span className="text-sm text-gray-500">Envoi en cours...</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Glissez vos fichiers ici ou{' '}
              <label className="cursor-pointer font-medium text-[#F5A623] hover:underline">
                parcourir
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </p>
            <p className="mt-1 text-xs text-gray-400">Images, PDF, Word, PowerPoint — max 10 fichiers, 10 Mo chacun</p>
          </>
        )}
      </div>
      {uploadError && (
        <p className="text-xs text-red-500">{uploadError}</p>
      )}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 rounded bg-[#F5A623]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#F5A623]">
                  {getFileIcon(f.name)}
                </span>
                <span className="truncate text-sm text-gray-700">{f.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400">{formatSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => void removeFile(i)}
                  className="text-gray-400 hover:text-red-500"
                  aria-label="Supprimer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Step15({ answers, onUpdate }: StepProps) {
  const primary = (answers.color_primary as string) ?? '#F5A623'
  const secondary = (answers.color_secondary as string) ?? '#1E293B'
  const autoColor = (answers.color_auto as boolean) ?? false

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">Couleurs</label>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 p-3">
        <input
          type="checkbox"
          checked={autoColor}
          onChange={(e) => onUpdate('color_auto', e.target.checked)}
          className="h-4 w-4 rounded accent-[#F5A623]"
        />
        <span className="text-sm text-gray-700">
          Utiliser des couleurs automatiques basees sur mon secteur
        </span>
      </label>
      {!autoColor && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs text-gray-500">
              Couleur principale
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primary}
                onChange={(e) => onUpdate('color_primary', e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                value={primary}
                onChange={(e) => onUpdate('color_primary', e.target.value)}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#F5A623]/40"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs text-gray-500">
              Couleur secondaire
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondary}
                onChange={(e) => onUpdate('color_secondary', e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                value={secondary}
                onChange={(e) => onUpdate('color_secondary', e.target.value)}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#F5A623]/40"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Step16({ answers, onUpdate }: StepProps) {
  const selected = (answers.languages as string[]) ?? ['fr']

  function toggle(value: string) {
    if (value === 'fr') return // fr is always selected
    if (selected.includes(value)) {
      onUpdate('languages', selected.filter((v) => v !== value))
    } else {
      onUpdate('languages', [...selected, value])
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Langues du site
      </label>
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map((lang) => (
          <label
            key={lang.value}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition-all ${
              selected.includes(lang.value)
                ? 'border-[#F5A623] bg-[#F5A623]/5'
                : 'border-gray-200 hover:border-gray-300'
            } ${lang.value === 'fr' ? 'opacity-75' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(lang.value)}
              onChange={() => toggle(lang.value)}
              disabled={lang.value === 'fr'}
              className="h-4 w-4 rounded accent-[#F5A623]"
            />
            <span className="text-sm text-gray-700">{lang.label}</span>
            {lang.value === 'fr' && (
              <span className="ml-auto text-xs text-gray-400">par defaut</span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

function Step17({ answers, onUpdate }: StepProps) {
  const selected = (answers.tone as string) ?? ''

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Ton de communication
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {TONES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onUpdate('tone', t.value)}
            className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
              selected === t.value
                ? 'border-[#F5A623] bg-[#F5A623]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-sm font-medium text-gray-700">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function StepBranding(props: StepProps) {
  switch (props.step) {
    case 14:
      return <Step14 {...props} />
    case 15:
      return <Step15 {...props} />
    case 16:
      return <Step16 {...props} />
    case 17:
      return <Step17 {...props} />
    default:
      return null
  }
}
