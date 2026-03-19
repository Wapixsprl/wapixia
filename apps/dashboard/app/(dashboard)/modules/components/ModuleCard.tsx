'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────
export interface ModuleItem {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  price_monthly: number
  is_active: boolean
  has_prerequisites: boolean
  prerequisites_met: boolean
}

// ─── Module icon SVG paths ───────────────────────────────────────
const MODULE_ICONS: Record<string, string> = {
  social_posts:
    'M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84',
  gmb_reviews:
    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  blog_seo:
    'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  gmb_posts:
    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  email_campaigns:
    'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
}

function getIconPath(slug: string): string {
  return (
    MODULE_ICONS[slug] ??
    'M13 10V3L4 14h7v7l9-11h-7z' // default lightning bolt
  )
}

// ─── Props ───────────────────────────────────────────────────────
interface ModuleCardProps {
  module: ModuleItem
  siteId: string
  onToggle: (moduleId: string, active: boolean) => Promise<void>
}

export default function ModuleCard({
  module: mod,
  siteId,
  onToggle,
}: ModuleCardProps) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      await onToggle(mod.id, !mod.is_active)
    } finally {
      setToggling(false)
    }
  }

  const canActivate = !mod.has_prerequisites || mod.prerequisites_met

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        mod.is_active ? 'border-[#00D4B1]/40' : 'border-gray-200'
      }`}
    >
      {/* Active indicator */}
      {mod.is_active && (
        <div className="absolute right-0 top-0 h-1 w-full bg-[#00D4B1]" />
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Icon + toggle */}
        <div className="mb-4 flex items-start justify-between">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              mod.is_active ? 'bg-[#00D4B1]/10' : 'bg-gray-100'
            }`}
          >
            <svg
              className={`h-5 w-5 ${mod.is_active ? 'text-[#00D4B1]' : 'text-gray-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={getIconPath(mod.slug)}
              />
            </svg>
          </div>

          {/* Toggle */}
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={toggling || !canActivate}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#00D4B1] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              mod.is_active ? 'bg-[#00D4B1]' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={mod.is_active}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                mod.is_active ? 'translate-x-5' : 'translate-x-0.5'
              } mt-0.5`}
            />
          </button>
        </div>

        {/* Name */}
        <h3 className="mb-1 text-sm font-semibold text-gray-900">{mod.name}</h3>

        {/* Description */}
        <p className="mb-4 flex-1 text-xs leading-relaxed text-gray-500">
          {mod.description}
        </p>

        {/* Prerequisites badge */}
        {mod.has_prerequisites && !mod.prerequisites_met && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium text-amber-700">
              Prerequis manquants
            </p>
          </div>
        )}

        {/* Footer: price + action */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-sm font-semibold text-gray-900">
            {mod.price_monthly}&euro;
            <span className="text-xs font-normal text-gray-400">/mois</span>
          </span>

          {mod.is_active ? (
            <Link
              href={`/modules/${mod.id}`}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              Configurer
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void handleToggle()}
              disabled={toggling || !canActivate}
              className="rounded-lg bg-[#00D4B1] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#00BFA0] disabled:opacity-50"
            >
              {toggling ? 'Activation...' : 'Activer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
