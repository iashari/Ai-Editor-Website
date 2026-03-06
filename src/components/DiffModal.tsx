'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from './animations/MotionDiv'
import { getVersionContent, type VersionFull } from '@/lib/versions'
import { computeDiff, type DiffLine } from '@/lib/diff'

interface Props {
  open: boolean
  oldVersionId: string
  newVersionId: string
  isDark: boolean
  onClose: () => void
}

type ViewMode = 'split' | 'unified'

export default function DiffModal({ open, oldVersionId, newVersionId, isDark, onClose }: Props) {
  const [oldVersion, setOldVersion] = useState<VersionFull | null>(null)
  const [newVersion, setNewVersion] = useState<VersionFull | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [changeIndex, setChangeIndex] = useState(0)

  const changeRefs = useRef<(HTMLDivElement | null)[]>([])
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const isSyncing = useRef(false)

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    setOldVersion(null)
    setNewVersion(null)
    setChangeIndex(0)

    Promise.all([
      getVersionContent(oldVersionId),
      getVersionContent(newVersionId),
    ])
      .then(([a, b]) => {
        // Ensure older version (lower version_number) is always on the left
        const [older, newer] = a.version_number <= b.version_number ? [a, b] : [b, a]
        setOldVersion(older)
        setNewVersion(newer)
      })
      .catch((err) => console.error('Failed to load versions for diff:', err))
      .finally(() => setIsLoading(false))
  }, [open, oldVersionId, newVersionId])

  const diff = useMemo(() => {
    if (!oldVersion || !newVersion) return null
    return computeDiff(oldVersion.content, newVersion.content)
  }, [oldVersion, newVersion])

  // Indices of change groups (first line of each added/removed block)
  const changePositions = useMemo(() => {
    if (!diff) return []
    const positions: number[] = []
    let prevType: string | null = null
    diff.lines.forEach((line, i) => {
      if (line.type !== 'unchanged' && line.type !== prevType) {
        positions.push(i)
      }
      prevType = line.type
    })
    return positions
  }, [diff])

  const navigateChange = useCallback((direction: 'prev' | 'next') => {
    if (changePositions.length === 0) return
    let next: number
    if (direction === 'next') {
      next = changeIndex < changePositions.length - 1 ? changeIndex + 1 : 0
    } else {
      next = changeIndex > 0 ? changeIndex - 1 : changePositions.length - 1
    }
    setChangeIndex(next)
    const lineIdx = changePositions[next]
    changeRefs.current[lineIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [changeIndex, changePositions])

  // Synced scroll for split view
  function handleSyncScroll(source: 'left' | 'right') {
    if (isSyncing.current) return
    isSyncing.current = true
    const srcEl = source === 'left' ? leftScrollRef.current : rightScrollRef.current
    const tgtEl = source === 'left' ? rightScrollRef.current : leftScrollRef.current
    if (srcEl && tgtEl) {
      tgtEl.scrollTop = srcEl.scrollTop
    }
    requestAnimationFrame(() => { isSyncing.current = false })
  }

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        navigateChange('next')
      }
      if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        navigateChange('prev')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, navigateChange])

  function formatTimestamp(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  }

  // Split view: build parallel left/right arrays
  const splitLines = useMemo(() => {
    if (!diff) return { left: [] as (DiffLine | null)[], right: [] as (DiffLine | null)[] }
    const left: (DiffLine | null)[] = []
    const right: (DiffLine | null)[] = []

    let i = 0
    const lines = diff.lines
    while (i < lines.length) {
      const line = lines[i]
      if (line.type === 'unchanged') {
        left.push(line)
        right.push(line)
        i++
      } else if (line.type === 'removed') {
        // Collect consecutive removed lines
        const removedStart = i
        while (i < lines.length && lines[i].type === 'removed') i++
        // Collect consecutive added lines right after
        const addedStart = i
        while (i < lines.length && lines[i].type === 'added') i++

        const removedCount = addedStart - removedStart
        const addedCount = i - addedStart
        const maxCount = Math.max(removedCount, addedCount)

        for (let j = 0; j < maxCount; j++) {
          left.push(j < removedCount ? lines[removedStart + j] : null)
          right.push(j < addedCount ? lines[addedStart + j] : null)
        }
      } else if (line.type === 'added') {
        left.push(null)
        right.push(line)
        i++
      } else {
        i++
      }
    }
    return { left, right }
  }, [diff])

  const lineClasses = useCallback((type: DiffLine['type'] | null) => {
    if (!type || type === 'unchanged') return ''
    if (type === 'added') return isDark ? 'bg-green-500/10' : 'bg-green-50'
    if (type === 'removed') return isDark ? 'bg-red-500/10' : 'bg-red-50'
    return ''
  }, [isDark])

  const lineNumClass = isDark ? 'text-neutral-600' : 'text-[#c5c0b8]'
  const contentClass = isDark ? 'text-neutral-300' : 'text-[#2d2a26]'
  const addedTextClass = isDark ? 'text-green-400' : 'text-green-800'
  const removedTextClass = isDark ? 'text-red-400' : 'text-red-800'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-[60] flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-[#faf8f5]'}`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-900' : 'border-[#e8e4dc] bg-white'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              </button>
              {oldVersion && newVersion && (
                <div className="flex items-center gap-2 text-xs min-w-0 flex-wrap">
                  <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700'}`}>
                    v{oldVersion.version_number}
                  </span>
                  {oldVersion.label && <span className={`truncate ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>{oldVersion.label}</span>}
                  <span className={isDark ? 'text-neutral-600' : 'text-[#c5c0b8]'}>{formatTimestamp(oldVersion.created_at)}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? 'text-neutral-600' : 'text-[#c5c0b8]'}><polyline points="9 18 15 12 9 6" /></svg>
                  <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'}`}>
                    v{newVersion.version_number}
                  </span>
                  {newVersion.label && <span className={`truncate ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>{newVersion.label}</span>}
                  <span className={isDark ? 'text-neutral-600' : 'text-[#c5c0b8]'}>{formatTimestamp(newVersion.created_at)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Stats */}
              {diff && (
                <div className="hidden sm:flex items-center gap-2 text-xs mr-2">
                  <span className={isDark ? 'text-green-400' : 'text-green-700'}>+{diff.stats.added}</span>
                  <span className={isDark ? 'text-red-400' : 'text-red-700'}>-{diff.stats.removed}</span>
                  <span className={isDark ? 'text-neutral-500' : 'text-[#9c958a]'}>~{diff.stats.unchanged}</span>
                </div>
              )}

              {/* Change navigation */}
              {changePositions.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigateChange('prev')}
                    className={`p-1 rounded-md transition-colors ${isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                  </button>
                  <span className={`text-xs tabular-nums min-w-[3rem] text-center ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
                    {changeIndex + 1}/{changePositions.length}
                  </span>
                  <button
                    onClick={() => navigateChange('next')}
                    className={`p-1 rounded-md transition-colors ${isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                </div>
              )}

              {/* View toggle */}
              <div className={`flex rounded-lg border overflow-hidden ${isDark ? 'border-neutral-700' : 'border-[#d5d0c8]'}`}>
                <button
                  onClick={() => setViewMode('split')}
                  className={`text-xs px-2.5 py-1 transition-colors ${
                    viewMode === 'split'
                      ? isDark ? 'bg-neutral-700 text-white' : 'bg-[#2d2a26] text-white'
                      : isDark ? 'text-neutral-400 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'
                  }`}
                >
                  Split
                </button>
                <button
                  onClick={() => setViewMode('unified')}
                  className={`text-xs px-2.5 py-1 transition-colors ${
                    viewMode === 'unified'
                      ? isDark ? 'bg-neutral-700 text-white' : 'bg-[#2d2a26] text-white'
                      : isDark ? 'text-neutral-400 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'
                  }`}
                >
                  Unified
                </button>
              </div>

              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>

          {/* Diff content */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className={`w-6 h-6 border-2 rounded-full animate-spin ${isDark ? 'border-neutral-700 border-t-neutral-400' : 'border-[#d5d0c8] border-t-[#9c958a]'}`} />
              </div>
            ) : !diff ? (
              <div className="h-full flex items-center justify-center">
                <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>Failed to compute diff</p>
              </div>
            ) : viewMode === 'split' ? (
              /* Split View */
              <div className="h-full flex">
                {/* Left (old) */}
                <div
                  ref={leftScrollRef}
                  onScroll={() => handleSyncScroll('left')}
                  className={`flex-1 overflow-auto border-r ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}
                >
                  <div className={`sticky top-0 z-10 px-3 py-1.5 text-xs font-medium border-b ${
                    isDark ? 'bg-neutral-900 border-neutral-800 text-red-400' : 'bg-white border-[#e8e4dc] text-red-700'
                  }`}>
                    Old — v{oldVersion?.version_number}
                  </div>
                  <div className="font-mono text-xs leading-6">
                    {splitLines.left.map((line, i) => (
                      <div
                        key={`l-${i}`}
                        ref={(el) => {
                          if (line && line.type !== 'unchanged') {
                            const idx = diff.lines.indexOf(line)
                            if (idx >= 0) changeRefs.current[idx] = el
                          }
                        }}
                        className={`flex ${lineClasses(line?.type ?? null)}`}
                      >
                        <span className={`w-10 shrink-0 text-right pr-2 select-none ${lineNumClass}`}>
                          {line?.lineNumberOld ?? ''}
                        </span>
                        <span className={`flex-1 px-2 whitespace-pre-wrap break-all ${
                          line?.type === 'removed' ? removedTextClass : contentClass
                        }`}>
                          {line?.content ?? ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right (new) */}
                <div
                  ref={rightScrollRef}
                  onScroll={() => handleSyncScroll('right')}
                  className="flex-1 overflow-auto"
                >
                  <div className={`sticky top-0 z-10 px-3 py-1.5 text-xs font-medium border-b ${
                    isDark ? 'bg-neutral-900 border-neutral-800 text-green-400' : 'bg-white border-[#e8e4dc] text-green-700'
                  }`}>
                    New — v{newVersion?.version_number}
                  </div>
                  <div className="font-mono text-xs leading-6">
                    {splitLines.right.map((line, i) => (
                      <div
                        key={`r-${i}`}
                        ref={(el) => {
                          if (line && line.type !== 'unchanged') {
                            const idx = diff.lines.indexOf(line)
                            if (idx >= 0) changeRefs.current[idx] = el
                          }
                        }}
                        className={`flex ${lineClasses(line?.type ?? null)}`}
                      >
                        <span className={`w-10 shrink-0 text-right pr-2 select-none ${lineNumClass}`}>
                          {line?.lineNumberNew ?? ''}
                        </span>
                        <span className={`flex-1 px-2 whitespace-pre-wrap break-all ${
                          line?.type === 'added' ? addedTextClass : contentClass
                        }`}>
                          {line?.content ?? ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Unified View */
              <div className="h-full overflow-auto">
                <div className="font-mono text-xs leading-6">
                  {diff.lines.map((line, i) => (
                    <div
                      key={i}
                      ref={(el) => {
                        if (line.type !== 'unchanged') changeRefs.current[i] = el
                      }}
                      className={`flex ${lineClasses(line.type)}`}
                    >
                      <span className={`w-10 shrink-0 text-right pr-1 select-none ${lineNumClass}`}>
                        {line.lineNumberOld ?? ''}
                      </span>
                      <span className={`w-10 shrink-0 text-right pr-1 select-none ${lineNumClass}`}>
                        {line.lineNumberNew ?? ''}
                      </span>
                      <span className={`w-4 shrink-0 text-center select-none ${
                        line.type === 'added' ? addedTextClass
                          : line.type === 'removed' ? removedTextClass
                            : isDark ? 'text-neutral-700' : 'text-[#d5d0c8]'
                      }`}>
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className={`flex-1 px-2 whitespace-pre-wrap break-all ${
                        line.type === 'added' ? addedTextClass
                          : line.type === 'removed' ? removedTextClass
                            : contentClass
                      }`}>
                        {line.content}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
