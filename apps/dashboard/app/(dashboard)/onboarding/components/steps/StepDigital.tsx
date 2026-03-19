'use client'

import type { StepProps } from '../../types'

function Step18({ answers, onUpdate }: StepProps) {
  const socials = [
    { key: 'social_facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
    { key: 'social_instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
    { key: 'social_linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/...' },
    { key: 'social_youtube', label: 'YouTube', placeholder: 'https://youtube.com/@...' },
  ]

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Reseaux sociaux
      </label>
      <p className="text-xs text-gray-400">
        Ajoutez vos liens de reseaux sociaux (optionnel)
      </p>
      <div className="space-y-3">
        {socials.map((s) => (
          <div key={s.key}>
            <label className="mb-1 block text-xs text-gray-500">
              {s.label}
            </label>
            <input
              type="url"
              value={(answers[s.key] as string) ?? ''}
              onChange={(e) => onUpdate(s.key, e.target.value)}
              placeholder={s.placeholder}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function Step19({ answers, onUpdate }: StepProps) {
  const hasGmb = (answers.has_gmb as boolean) ?? false
  const gmbUrl = (answers.gmb_url as string) ?? ''
  const gmbRating = (answers.gmb_rating as string) ?? ''
  const gmbReviews = (answers.gmb_review_count as string) ?? ''

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Google My Business
      </label>
      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
        <span className="text-sm text-gray-700">
          J&apos;ai une fiche Google My Business
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={hasGmb}
          onClick={() => onUpdate('has_gmb', !hasGmb)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
            hasGmb ? 'bg-[#00D4B1]' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
              hasGmb ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
      {hasGmb && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              URL de votre fiche
            </label>
            <input
              type="url"
              value={gmbUrl}
              onChange={(e) => onUpdate('gmb_url', e.target.value)}
              placeholder="https://g.page/..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Note moyenne
              </label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={gmbRating}
                onChange={(e) => onUpdate('gmb_rating', e.target.value)}
                placeholder="4.5"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Nombre d&apos;avis
              </label>
              <input
                type="number"
                min="0"
                value={gmbReviews}
                onChange={(e) => onUpdate('gmb_review_count', e.target.value)}
                placeholder="42"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00D4B1]/40"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StepDigital(props: StepProps) {
  switch (props.step) {
    case 18:
      return <Step18 {...props} />
    case 19:
      return <Step19 {...props} />
    default:
      return null
  }
}
