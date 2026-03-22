'use client'

import React from 'react'
import { cn } from '../../lib/utils'

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  shimmerColor?: string
  shimmerSize?: string
  shimmerDuration?: string
  background?: string
  borderRadius?: string
}

export function ShimmerButton({
  children,
  className,
  shimmerColor = '#F5A623',
  shimmerSize = '0.05em',
  shimmerDuration = '3s',
  background = 'rgba(0,0,0,1)',
  borderRadius = '100px',
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      className={cn(
        'group relative inline-flex items-center justify-center overflow-hidden whitespace-nowrap px-6 py-3 text-white',
        'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px',
        className
      )}
      style={
        {
          '--shimmer-color': shimmerColor,
          '--shimmer-size': shimmerSize,
          '--shimmer-duration': shimmerDuration,
          '--bg': background,
          '--radius': borderRadius,
          borderRadius: 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    >
      {/* Shimmer effect */}
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius: 'var(--radius)' }}
      >
        <span
          className="absolute inset-[-100%] animate-[shimmer_var(--shimmer-duration)_linear_infinite]"
          style={{
            background: `conic-gradient(from 0deg, transparent 0%, var(--shimmer-color) 10%, transparent 20%)`,
          }}
        />
      </span>

      {/* Background */}
      <span
        className="absolute inset-[var(--shimmer-size)]"
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--radius)',
        }}
      />

      {/* Content */}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

export default ShimmerButton
