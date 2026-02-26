'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from './animations/MotionDiv'
import type { CollaboratorPresence } from '@/hooks/useCollaboration'

interface CursorPosition {
  userId: string
  displayName: string
  color: string
  top: number
  left: number
}

interface CursorOverlayProps {
  collaborators: CollaboratorPresence[]
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  content: string
  isDark: boolean
  lineHeight?: number
  paddingTop?: number
  paddingLeft?: number
}

function measureCharWidth(textarea: HTMLTextAreaElement): number {
  const style = getComputedStyle(textarea)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 7.8
  ctx.font = `${style.fontSize} ${style.fontFamily}`
  return ctx.measureText('M').width
}

function computePositions(
  textarea: HTMLTextAreaElement,
  collaborators: CollaboratorPresence[],
  lh: number,
  cw: number,
  pt: number,
  pl: number
): CursorPosition[] {
  const scrollTop = textarea.scrollTop
  const scrollLeft = textarea.scrollLeft
  const clientHeight = textarea.clientHeight

  const result: CursorPosition[] = []
  for (const collab of collaborators) {
    if (!collab.cursor) continue
    const top = (collab.cursor.line - 1) * lh + pt - scrollTop
    const left = collab.cursor.col * cw + pl - scrollLeft
    if (top < -40 || top > clientHeight + lh) continue
    result.push({
      userId: collab.userId,
      displayName: collab.displayName,
      color: collab.color,
      top,
      left,
    })
  }
  return result
}

/** Individual cursor that auto-hides after 2s of no movement */
function CursorIndicator({ pos, lh, isDark }: { pos: CursorPosition; lh: number; isDark: boolean }) {
  const [visible, setVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPos = useRef({ top: pos.top, left: pos.left })

  useEffect(() => {
    if (prevPos.current.top !== pos.top || prevPos.current.left !== pos.left) {
      setVisible(true)
      prevPos.current = { top: pos.top, left: pos.left }
    }
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setVisible(false), 2000)
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [pos.top, pos.left])

  if (!visible) return null

  const firstName = pos.displayName.split(' ')[0]

  return (
    <motion.div
      animate={{ top: pos.top, left: pos.left, opacity: 1 }}
      initial={{ opacity: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{ type: 'spring', damping: 30, stiffness: 400, mass: 0.5 }}
      className="absolute"
    >
      <div
        className="absolute left-0 flex items-center gap-1 px-1.5 py-[2px] rounded-t-md rounded-tr-md text-[10px] font-bold whitespace-nowrap"
        style={{
          bottom: '100%',
          backgroundColor: pos.color,
          color: isDark ? '#0a0a0a' : '#ffffff',
          boxShadow: `0 2px 8px ${pos.color}40`,
        }}
      >
        {firstName}
      </div>
      <div
        className="rounded-full"
        style={{
          width: 2.5,
          height: lh - 2,
          backgroundColor: pos.color,
          boxShadow: `0 0 6px ${pos.color}80`,
        }}
      />
    </motion.div>
  )
}

export default function CursorOverlay({
  collaborators,
  textareaRef,
  content,
  isDark,
  lineHeight,
  paddingTop,
  paddingLeft,
}: CursorOverlayProps) {
  const [positions, setPositions] = useState<CursorPosition[]>([])
  const measuredRef = useRef<{ charWidth: number; lineHeight: number; paddingTop: number; paddingLeft: number } | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const style = getComputedStyle(textarea)
    const cw = measureCharWidth(textarea)
    const lh = lineHeight ?? (parseFloat(style.lineHeight) || 24)
    const pt = paddingTop ?? (parseFloat(style.paddingTop) || 0)
    const pl = paddingLeft ?? (parseFloat(style.paddingLeft) || 0)
    measuredRef.current = { charWidth: cw, lineHeight: lh, paddingTop: pt, paddingLeft: pl }

    const update = () => {
      const m = measuredRef.current!
      setPositions(computePositions(textarea, collaborators, m.lineHeight, m.charWidth, m.paddingTop, m.paddingLeft))
    }
    update()

    textarea.addEventListener('scroll', update)
    return () => textarea.removeEventListener('scroll', update)
  }, [textareaRef, collaborators, content, lineHeight, paddingTop, paddingLeft])

  const lh = measuredRef.current?.lineHeight ?? lineHeight ?? 24

  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{ inset: 0, overflow: 'visible' }}
    >
      <AnimatePresence>
        {positions.map((pos) => (
          <CursorIndicator key={pos.userId} pos={pos} lh={lh} isDark={isDark} />
        ))}
      </AnimatePresence>
    </div>
  )
}
