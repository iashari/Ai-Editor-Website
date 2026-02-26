'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from './animations/MotionDiv'
import { useThrottle } from '@/hooks/useThrottle'
import type { CollaboratorPresence } from '@/hooks/useCollaboration'

interface LiveCursorsProps {
  collaborators: CollaboratorPresence[]
  onMouseMove: (x: number, y: number) => void
  containerRef: React.RefObject<HTMLElement | null>
  isDark: boolean
}

function CursorPointer({ collab, isDark }: { collab: CollaboratorPresence; isDark: boolean }) {
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPos = useRef(collab.mouse)

  // Show cursor when moving, hide after 2s idle
  useEffect(() => {
    if (!collab.mouse) return
    if (prevPos.current?.x !== collab.mouse.x || prevPos.current?.y !== collab.mouse.y) {
      setVisible(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      hideTimerRef.current = setTimeout(() => setVisible(false), 2000)
      prevPos.current = collab.mouse
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [collab.mouse])

  const firstName = collab.displayName.split(' ')[0]

  if (!visible) return null

  return (
    <motion.div
      animate={{
        x: collab.mouse!.x,
        y: collab.mouse!.y,
        opacity: 1,
      }}
      initial={{ opacity: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{
        x: { type: 'spring', damping: 28, stiffness: 380, mass: 0.35 },
        y: { type: 'spring', damping: 28, stiffness: 380, mass: 0.35 },
        opacity: { duration: 0.2 },
      }}
      className="absolute top-0 left-0"
      style={{ willChange: 'transform' }}
    >
      {/* Pointer arrow SVG */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={collab.color}
        style={{ filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.35))` }}
      >
        <path
          d="M5.65 1.35L22 12.5l-7.15 1.65L12.5 22z"
          stroke={isDark ? '#0a0a0a' : '#ffffff'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {/* Name tag */}
      <div
        className="absolute left-4 top-4 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
        style={{
          backgroundColor: collab.color,
          color: isDark ? '#0a0a0a' : '#ffffff',
          boxShadow: `0 2px 8px ${collab.color}50`,
        }}
      >
        {firstName}
      </div>
    </motion.div>
  )
}

export default function LiveCursors({ collaborators, onMouseMove, containerRef, isDark }: LiveCursorsProps) {
  const throttledMouseMove = useThrottle((x: number, y: number) => {
    onMouseMove(x, y)
  }, 25)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    throttledMouseMove(e.clientX - rect.left, e.clientY - rect.top)
  }, [containerRef, throttledMouseMove])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('mousemove', handleMouseMove)
    return () => container.removeEventListener('mousemove', handleMouseMove)
  }, [containerRef, handleMouseMove])

  const cursorsWithMouse = collaborators.filter((c) => c.mouse)

  if (cursorsWithMouse.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {cursorsWithMouse.map((collab) => (
          <CursorPointer key={collab.userId} collab={collab} isDark={isDark} />
        ))}
      </AnimatePresence>
    </div>
  )
}
