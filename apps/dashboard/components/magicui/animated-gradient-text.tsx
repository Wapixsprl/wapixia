'use client'

import React from 'react'
import { cn } from '../../lib/utils'

interface AnimatedGradientTextProps {
  children: React.ReactNode
  className?: string
}

export function AnimatedGradientText({
  children,
  className,
}: AnimatedGradientTextProps) {
  return (
    <span
      className={cn(
        'inline-flex animate-gradient-text bg-gradient-to-r from-[#F5A623] via-[#ffcc66] to-[#F5A623] bg-[length:200%_auto] bg-clip-text text-transparent',
        className
      )}
    >
      {children}
    </span>
  )
}

export default AnimatedGradientText
