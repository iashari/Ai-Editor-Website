'use client'

import { motion } from './MotionDiv'
import { type ReactNode } from 'react'

interface AnimatedItemProps {
  index: number
  direction?: 'up' | 'left' | 'right'
  children: ReactNode
  className?: string
}

const directionOffset = {
  up: { x: 0, y: 12 },
  left: { x: -16, y: 0 },
  right: { x: 16, y: 0 },
}

export default function AnimatedItem({ index, direction = 'up', children, className }: AnimatedItemProps) {
  const offset = directionOffset[direction]
  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
