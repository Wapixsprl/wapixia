'use client'

import React, { useEffect, useRef } from 'react'
import {
  useMotionValue,
  useTransform,
  useSpring,
  useInView,
  motion,
} from 'framer-motion'
import { cn } from '../../lib/utils'

interface NumberTickerProps {
  value: number
  className?: string
  delay?: number
  direction?: 'up' | 'down'
  decimalPlaces?: number
}

export function NumberTicker({
  value,
  className,
  delay = 0,
  direction = 'up',
  decimalPlaces = 0,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  const motionValue = useMotionValue(direction === 'up' ? 0 : value)
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  })
  const displayValue = useTransform(springValue, (latest: number) =>
    latest.toFixed(decimalPlaces)
  )

  useEffect(() => {
    if (!isInView) return

    const timeout = setTimeout(() => {
      motionValue.set(direction === 'up' ? value : 0)
    }, delay * 1000)

    return () => clearTimeout(timeout)
  }, [isInView, value, delay, direction, motionValue])

  return (
    <motion.span ref={ref} className={cn('tabular-nums', className)}>
      {displayValue}
    </motion.span>
  )
}

export default NumberTicker
