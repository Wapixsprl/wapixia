'use client'

import React from 'react'
import { cn } from '../../lib/utils'

interface MarqueeProps {
  children: React.ReactNode
  className?: string
  pauseOnHover?: boolean
  reverse?: boolean
  vertical?: boolean
  repeat?: number
}

export function Marquee({
  children,
  className,
  pauseOnHover = false,
  reverse = false,
  vertical = false,
  repeat = 4,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        'group flex overflow-hidden [--duration:40s] [--gap:1rem]',
        vertical ? 'flex-col' : 'flex-row',
        className
      )}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 justify-around [gap:var(--gap)]',
            vertical ? 'flex-col' : 'flex-row',
            vertical
              ? 'animate-marquee-vertical'
              : 'animate-marquee',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]'
          )}
          style={{
            animationDuration: 'var(--duration)',
          }}
        >
          {children}
        </div>
      ))}
    </div>
  )
}

export default Marquee
