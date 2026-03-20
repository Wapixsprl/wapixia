'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '../../../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────
interface ModuleConfig {
  id: string
  slug: string
  name: string
  description: string
  is_active: boolean
  settings: Record<string, unknown>
}

const WEEKDAYS = [
  { key: 'monday', label: 'Lun' },
  { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mer' },
  { key: 'thursday', label: 'Jeu' },
  { key: 'friday', label: 'Ven' },
  { key: 'saturday', label: 'Sam' },
  { key: 'sunday', label: 'Dim' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00`,
}))

export default function ModuleSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const moduleId = params.moduleId as string

  const [siteId, setSiteId] = useState<string | null>(null)
  const [config, setConfig] = useState<ModuleConfig | null>(null)
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Resolve siteId
  useEffect(() => {
    async function resolveSite() {
      const supabase = createBrowserClient()
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
  }, [])

  const fetchModule = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    setError(null)
    try {
      const supabase = createBrowserClient()
      // Get module from catalog
      const { data: catalogItem } = await supabase.from('module_catalog').select('*').eq('id', moduleId).single()
      // Get site module config
      const { data: siteModule } = await supabase.from('site_modules').select('*').eq('site_id', siteId).eq('module_id', moduleId).single()
      if (catalogItem) {
        setConfig({
          id: catalogItem.id,
          slug: catalogItem.id,
          name: catalogItem.name,
          description: catalogItem.description,
          is_active: siteModule?.status === 'active',
          settings: (siteModule?.config as Record<string, unknown>) ?? {},
        })
        setSettings((siteModule?.config as Record<string, unknown>) ?? {})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [siteId, moduleId])

  useEffect(() => {
    void fetchModule()
  }, [fetchModule])

  // ─── Setting helpers ─────────────────────────────────────────
  function updateSetting(key: string, value: unknown) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function getBoolean(key: string, fallback = false): boolean {
    return typeof settings[key] === 'boolean'
      ? (settings[key] as boolean)
      : fallback
  }

  function getNumber(key: string, fallback = 0): number {
    return typeof settings[key] === 'number'
      ? (settings[key] as number)
      : fallback
  }

  function getStringArray(key: string): string[] {
    return Array.isArray(settings[key])
      ? (settings[key] as string[])
      : []
  }

  function getString(key: string, fallback = ''): string {
    return typeof settings[key] === 'string'
      ? (settings[key] as string)
      : fallback
  }

  // ─── Save ────────────────────────────────────────────────────
  async function handleSave() {
    if (!siteId) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const supabase = createBrowserClient()
      const { data: existing } = await supabase.from('site_modules').select('id').eq('site_id', siteId).eq('module_id', moduleId).single()
      if (existing) {
        await supabase.from('site_modules').update({ config: settings }).eq('id', existing.id)
      }
      setSuccess('Configuration sauvegardee')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ─── Generate now ────────────────────────────────────────────
  async function handleGenerate() {
    if (!siteId) return
    setGenerating(true)
    setError(null)
    try {
      // Generation will be handled by the API backend when deployed
      setSuccess('Generation sera disponible prochainement')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de generation')
    } finally {
      setGenerating(false)
    }
  }

  // ─── Loading / Error states ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="text-center">
        <p className="text-sm text-gray-500">Module introuvable</p>
        <button
          type="button"
          onClick={() => router.push('/modules')}
          className="mt-4 text-sm font-medium text-[#F5A623] hover:underline"
        >
          Retour aux modules
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push('/modules')}
        className="mb-4 flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour aux modules
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
        <p className="mt-1 text-sm text-gray-500">{config.description}</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Settings form */}
      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {config.slug === 'social_posts' && (
          <SocialPostsSettings
            settings={{ getBoolean, getNumber, getStringArray }}
            onUpdate={updateSetting}
          />
        )}

        {config.slug === 'gmb_reviews' && (
          <GmbReviewsSettings
            settings={{ getBoolean, getString }}
            onUpdate={updateSetting}
          />
        )}

        {config.slug === 'blog_seo' && (
          <BlogSeoSettings
            settings={{ getBoolean, getNumber, getStringArray }}
            onUpdate={updateSetting}
          />
        )}

        {/* Generic fallback for unknown module types */}
        {!['social_posts', 'gmb_reviews', 'blog_seo'].includes(config.slug) && (
          <div className="text-sm text-gray-500">
            Aucun parametre specifique pour ce module.
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              Generation...
            </span>
          ) : (
            'Generer maintenant'
          )}
        </button>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-lg bg-[#F5A623] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#E09600] disabled:opacity-50"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Module-specific settings components
// ═══════════════════════════════════════════════════════════════════

interface SettingAccessors {
  getBoolean: (key: string, fallback?: boolean) => boolean
  getNumber: (key: string, fallback?: number) => number
  getStringArray: (key: string) => string[]
  getString: (key: string, fallback?: string) => string
}

// ─── Social Posts ────────────────────────────────────────────────
function SocialPostsSettings({
  settings: s,
  onUpdate,
}: {
  settings: Pick<SettingAccessors, 'getBoolean' | 'getNumber' | 'getStringArray'>
  onUpdate: (key: string, value: unknown) => void
}) {
  const postsPerMonth = s.getNumber('posts_per_month', 12)
  const platforms = s.getStringArray('platforms')
  const postingDays = s.getStringArray('posting_days')
  const postingHour = s.getNumber('posting_hour', 10)

  function togglePlatform(platform: string) {
    const current = s.getStringArray('platforms')
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform]
    onUpdate('platforms', next)
  }

  function toggleDay(day: string) {
    const current = s.getStringArray('posting_days')
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day]
    onUpdate('posting_days', next)
  }

  return (
    <>
      {/* Auto-publish toggle */}
      <ToggleRow
        label="Publication automatique"
        description="Publier automatiquement les posts approuves"
        checked={s.getBoolean('auto_publish')}
        onChange={(v) => onUpdate('auto_publish', v)}
      />

      {/* Posts per month slider */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Posts par mois
          </label>
          <span className="text-sm font-semibold text-[#F5A623]">
            {postsPerMonth}
          </span>
        </div>
        <input
          type="range"
          min={8}
          max={20}
          step={4}
          value={postsPerMonth}
          onChange={(e) => onUpdate('posts_per_month', Number(e.target.value))}
          className="w-full accent-[#F5A623]"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>8</span>
          <span>12</span>
          <span>16</span>
          <span>20</span>
        </div>
      </div>

      {/* Platform checkboxes */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Plateformes
        </label>
        <div className="flex gap-3">
          {[
            { key: 'facebook', label: 'Facebook', color: 'bg-blue-500' },
            { key: 'instagram', label: 'Instagram', color: 'bg-gradient-to-br from-purple-500 to-pink-500' },
          ].map((p) => (
            <label
              key={p.key}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                platforms.includes(p.key)
                  ? 'border-[#F5A623] bg-[#F5A623]/5 text-gray-900'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={platforms.includes(p.key)}
                onChange={() => togglePlatform(p.key)}
                className="sr-only"
              />
              <span className={`h-3 w-3 rounded-full ${p.color}`} />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {/* Posting days */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Jours de publication
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDay(d.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                postingDays.includes(d.key)
                  ? 'bg-[#F5A623] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posting hour */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Heure de publication
        </label>
        <select
          value={postingHour}
          onChange={(e) => onUpdate('posting_hour', Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
        >
          {HOURS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

// ─── GMB Reviews ─────────────────────────────────────────────────
function GmbReviewsSettings({
  settings: s,
  onUpdate,
}: {
  settings: Pick<SettingAccessors, 'getBoolean' | 'getString'>
  onUpdate: (key: string, value: unknown) => void
}) {
  return (
    <>
      <ToggleRow
        label="Reponses automatiques"
        description="Publier automatiquement les reponses aux avis"
        checked={s.getBoolean('auto_publish_replies')}
        onChange={(v) => onUpdate('auto_publish_replies', v)}
      />

      <ToggleRow
        label="Posts GMB automatiques"
        description="Publier automatiquement les posts Google My Business"
        checked={s.getBoolean('auto_publish_gmb_posts')}
        onChange={(v) => onUpdate('auto_publish_gmb_posts', v)}
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Frequence de verification
        </label>
        <select
          value={s.getString('check_frequency', 'daily')}
          onChange={(e) => onUpdate('check_frequency', e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
        >
          <option value="hourly">Toutes les heures</option>
          <option value="daily">Quotidien</option>
          <option value="weekly">Hebdomadaire</option>
        </select>
      </div>

      <ToggleRow
        label="Alertes avis negatifs"
        description="Recevoir une notification pour les avis 1-2 etoiles"
        checked={s.getBoolean('alert_negative', true)}
        onChange={(v) => onUpdate('alert_negative', v)}
      />

      <ToggleRow
        label="Alertes nouveaux avis"
        description="Recevoir une notification pour chaque nouvel avis"
        checked={s.getBoolean('alert_new_review')}
        onChange={(v) => onUpdate('alert_new_review', v)}
      />
    </>
  )
}

// ─── Blog SEO ────────────────────────────────────────────────────
function BlogSeoSettings({
  settings: s,
  onUpdate,
}: {
  settings: Pick<SettingAccessors, 'getBoolean' | 'getNumber' | 'getStringArray'>
  onUpdate: (key: string, value: unknown) => void
}) {
  const [topicInput, setTopicInput] = useState('')
  const topics = s.getStringArray('topics')

  function addTopic() {
    const trimmed = topicInput.trim()
    if (trimmed && !topics.includes(trimmed)) {
      onUpdate('topics', [...topics, trimmed])
    }
    setTopicInput('')
  }

  function removeTopic(topic: string) {
    onUpdate(
      'topics',
      topics.filter((t) => t !== topic),
    )
  }

  return (
    <>
      <ToggleRow
        label="Publication automatique"
        description="Publier automatiquement les articles approuves"
        checked={s.getBoolean('auto_publish')}
        onChange={(v) => onUpdate('auto_publish', v)}
      />

      {/* Articles per month */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Articles par mois
          </label>
          <span className="text-sm font-semibold text-[#F5A623]">
            {s.getNumber('articles_per_month', 4)}
          </span>
        </div>
        <input
          type="range"
          min={4}
          max={8}
          step={4}
          value={s.getNumber('articles_per_month', 4)}
          onChange={(e) =>
            onUpdate('articles_per_month', Number(e.target.value))
          }
          className="w-full accent-[#F5A623]"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>4</span>
          <span>8</span>
        </div>
      </div>

      {/* Word count range */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Nombre de mots
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={s.getNumber('word_count_min', 800)}
            onChange={(e) =>
              onUpdate('word_count_min', Number(e.target.value))
            }
            min={300}
            max={3000}
            step={100}
            className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
          />
          <span className="text-sm text-gray-400">a</span>
          <input
            type="number"
            value={s.getNumber('word_count_max', 1500)}
            onChange={(e) =>
              onUpdate('word_count_max', Number(e.target.value))
            }
            min={300}
            max={5000}
            step={100}
            className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
          />
          <span className="text-sm text-gray-400">mots</span>
        </div>
      </div>

      {/* Topics */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Sujets
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 rounded-full bg-[#F5A623]/10 px-3 py-1 text-xs font-medium text-[#F5A623]"
            >
              {topic}
              <button
                type="button"
                onClick={() => removeTopic(topic)}
                className="ml-0.5 text-[#F5A623]/60 hover:text-[#F5A623]"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTopic()
              }
            }}
            placeholder="Ajouter un sujet..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
          />
          <button
            type="button"
            onClick={addTopic}
            disabled={!topicInput.trim()}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Shared toggle row component
// ═══════════════════════════════════════════════════════════════════

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#F5A623] focus:ring-offset-2 ${
          checked ? 'bg-[#F5A623]' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          } mt-0.5`}
        />
      </button>
    </div>
  )
}
