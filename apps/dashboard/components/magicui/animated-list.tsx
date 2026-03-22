'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface AnimatedListProps {
  children: React.ReactNode[]
  className?: string
  delay?: number
}

export function AnimatedList({
  children,
  className,
  delay = 1000,
}: AnimatedListProps) {
  const [index, setIndex] = useState(0)
  const childrenArray = useMemo(
    () => React.Children.toArray(children),
    [children]
  )

  useEffect(() => {
    if (index >= childrenArray.length) return

    const interval = setInterval(() => {
      setIndex((prev) => {
        if (prev >= childrenArray.length - 1) return prev
        return prev + 1
      })
    }, delay)

    return () => clearInterval(interval)
  }, [index, childrenArray.length, delay])

  const visibleItems = useMemo(
    () => childrenArray.slice(0, index + 1).reverse(),
    [index, childrenArray]
  )

  return (
    <div className={cn('flex flex-col gap-3 overflow-hidden', className)}>
      <AnimatePresence mode="popLayout">
        {visibleItems.map((child) => (
          <motion.div
            key={(child as React.ReactElement).key}
            layout
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{
              duration: 0.35,
              ease: 'easeOut',
            }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default AnimatedList
