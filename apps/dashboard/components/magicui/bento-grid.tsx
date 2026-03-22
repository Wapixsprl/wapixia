'use client'

import React from 'react'
import { cn } from '../../lib/utils'

interface BentoGridProps {
  children: React.ReactNode
  className?: string
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid auto-rows-[18rem] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  )
}

interface BentoCardProps {
  name: string
  description: string
  className?: string
  Icon?: React.ComponentType<{ className?: string }>
  href?: string
  cta?: string
  background?: React.ReactNode
}

export function BentoCard({
  name,
  description,
  className,
  Icon,
  href,
  cta,
  background,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/10 bg-neutral-950 p-6',
        'transform-gpu transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20',
        className
      )}
    >
      {/* Background */}
      {background && (
        <div className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-80">
          {background}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-2">
        {Icon && (
          <Icon className="h-8 w-8 text-[#F5A623] transition-transform duration-300 group-hover:scale-110" />
        )}
        <h3 className="text-lg font-semibold text-white">{name}</h3>
        <p className="text-sm text-neutral-400">{description}</p>
        {cta && href && (
          <a
            href={href}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#F5A623] transition-colors hover:text-[#ffcc66]"
          >
            {cta}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}

export default BentoGrid
