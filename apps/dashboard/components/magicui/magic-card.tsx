'use client'

import React, { useCallback, useState } from 'react'
import { cn } from '../../lib/utils'

interface MagicCardProps {
  children: React.ReactNode
  className?: string
  gradientColor?: string
  gradientSize?: number
  gradientOpacity?: number
}

export function MagicCard({
  children,
  className,
  gradientColor = '#F5A62320',
  gradientSize = 200,
  gradientOpacity = 0.8,
}: MagicCardProps) {
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    },
    []
  )

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 bg-neutral-950 p-6',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient spotlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? gradientOpacity : 0,
          background: `radial-gradient(${gradientSize}px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 70%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export default MagicCard
