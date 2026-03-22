'use client'

import React from 'react'
import { cn } from '../../lib/utils'

interface BorderBeamProps {
  className?: string
  size?: number
  duration?: number
  anchor?: number
  borderWidth?: number
  colorFrom?: string
  colorTo?: string
  delay?: number
}

export function BorderBeam({
  className,
  size = 200,
  duration = 15,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = '#F5A623',
  colorTo = '#ffcc66',
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        className
      )}
      style={
        {
          '--size': `${size}px`,
          '--duration': `${duration}s`,
          '--anchor': `${anchor}%`,
          '--border-width': `${borderWidth}px`,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--delay': `-${delay}s`,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          overflow: 'hidden',
          WebkitMask:
            'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: 'var(--border-width)',
        }}
      >
        <div
          className="absolute inset-[-100%] animate-[border-beam_var(--duration)_linear_infinite_var(--delay)]"
          style={{
            background: `conic-gradient(from calc(var(--anchor) * 1turn), transparent 0%, var(--color-from) 10%, var(--color-to) 20%, transparent 30%)`,
            width: 'var(--size)',
            height: 'var(--size)',
            top: '50%',
            left: '50%',
            translate: '-50% -50%',
            animationTimingFunction: 'linear',
          }}
        />
      </div>
    </div>
  )
}

export default BorderBeam
