'use client'

import React, { useRef } from 'react'
import { motion, useInView, type Variant } from 'framer-motion'
import { cn } from '../../lib/utils'

interface BlurFadeProps {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  inView?: boolean
  direction?: 'up' | 'down' | 'left' | 'right'
}

const directionOffset: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: 24 },
  down: { x: 0, y: -24 },
  left: { x: 24, y: 0 },
  right: { x: -24, y: 0 },
}

export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.4,
  inView = true,
  direction = 'up',
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  const offset = directionOffset[direction] ?? { x: 0, y: 24 }

  const hidden: Variant = {
    opacity: 0,
    filter: 'blur(12px)',
    x: offset.x,
    y: offset.y,
  }

  const visible: Variant = {
    opacity: 1,
    filter: 'blur(0px)',
    x: 0,
    y: 0,
  }

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial="hidden"
      animate={inView ? (isInView ? 'visible' : 'hidden') : 'visible'}
      variants={{
        hidden,
        visible,
      }}
      transition={{
        delay,
        duration,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  )
}

export default BlurFade
