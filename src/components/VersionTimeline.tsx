'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from './animations/MotionDiv'
import { getVersionList, restoreVersion, type VersionSummary } from '@/lib/versions'

interface Props {
  open: boolean
  documentId: string
  userId: string
  isDark: boolean
  onClose: () => void
  onRestore: (content: string, title: string) => void
  onCompare: (oldVersionId: string, newVersionId: string) => void
}

export default function VersionTimeline({
  open,
  documentId,
  userId,
  isDark,
  onClose,
  onRestore,
  onCompare,
}: Props) {
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  const loadVersions = useCallback(async (pageNum: number, append = false) => {
    try {
      setIsLoading(true)
      const result = await getVersionList(documentId, pageNum)
      setVersions((prev) => append ? [...prev, ...result.versions] : result.versions)
      setHasMore(result.hasMore)
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    if (!open) return
    setPage(0)
    setSelected(new Set())
    loadVersions(0)
  }, [open, documentId, loadVersions])

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 2) return prev
        next.add(id)
      }
      return next
    })
  }

  function handleQuickCompare() {
    if (versions.length < 2) return
    onCompare(versions[1].id, versions[0].id)
  }

  function handleCompareSelected() {
    if (selected.size !== 2) return
    const ids = Array.from(selected)
    // Sort by version_number so older is first
    const sorted = ids
      .map((id) => versions.find((v) => v.id === id)!)
      .sort((a, b) => a.version_number - b.version_number)
    onCompare(sorted[0].id, sorted[1].id)
  }

  async function handleRestore(versionId: string) {
    try {
      setIsRestoring(true)
      const result = await restoreVersion(documentId, versionId, userId)
      onRestore(result.content, result.title)
      setRestoreConfirmId(null)
      // Reload versions to show the new "Restored from vX"
      loadVersions(0)
    } catch (err) {
      console.error('Restore failed:', err)
    } finally {
      setIsRestoring(false)
    }
  }

  function loadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    loadVersions(nextPage, true)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`relative w-full max-w-lg mx-4 rounded-xl border shadow-xl flex flex-col ${
              isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#e8e4dc]'
            }`}
            style={{ maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? 'text-neutral-400' : 'text-[#5c574e]'}>
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#2d2a26]'}`}>Version History</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-neutral-800 text-neutral-500' : 'bg-[#f5f2ed] text-[#9c958a]'}`}>
                  {versions.length} versions
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Quick compare */}
                {versions.length >= 2 && (
                  <button
                    onClick={handleQuickCompare}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105 active:scale-95 ${
                      isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-[#f5f2ed] text-[#5c574e] hover:bg-[#ebe8e2]'
                    }`}
                  >
                    Quick compare
                  </button>
                )}
                {/* Compare selected */}
                {selected.size === 2 && (
                  <button
                    onClick={handleCompareSelected}
                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all hover:scale-105 active:scale-95"
                  >
                    Compare selected
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`p-1 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {isLoading && versions.length === 0 ? (
                <div className="py-8 text-center">
                  <div className={`w-6 h-6 mx-auto mb-2 border-2 rounded-full animate-spin ${isDark ? 'border-neutral-700 border-t-neutral-400' : 'border-[#d5d0c8] border-t-[#9c958a]'}`} />
                  <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>Loading versions...</p>
                </div>
              ) : versions.length === 0 ? (
                <div className={`py-8 text-center ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <p className="text-sm font-medium mb-1">No versions yet</p>
                  <p className="text-xs opacity-70">Versions are auto-saved every 30 seconds when content changes.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className={`absolute left-[15px] top-2 bottom-2 w-px ${isDark ? 'bg-neutral-800' : 'bg-[#e8e4dc]'}`} />

                  {versions.map((v, i) => {
                    const isSelected = selected.has(v.id)
                    const isLatest = i === 0

                    return (
                      <div key={v.id} className="relative flex gap-3 group mb-1">
                        {/* Timeline dot + checkbox */}
                        <div className="relative z-10 flex flex-col items-center pt-2.5">
                          <button
                            onClick={() => toggleSelect(v.id)}
                            className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500'
                                : isLatest
                                  ? isDark ? 'bg-neutral-900 border-white' : 'bg-white border-[#2d2a26]'
                                  : isDark ? 'bg-neutral-900 border-neutral-600 group-hover:border-neutral-400' : 'bg-white border-[#d5d0c8] group-hover:border-[#9c958a]'
                            }`}
                          >
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Content */}
                        <div className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                          isSelected
                            ? isDark ? 'bg-blue-500/10' : 'bg-blue-50'
                            : isDark ? 'hover:bg-neutral-800/50' : 'hover:bg-[#f5f2ed]'
                        }`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Version number badge */}
                            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                              isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-[#f0ede8] text-[#5c574e]'
                            }`}>
                              v{v.version_number}
                            </span>
                            {/* Latest badge */}
                            {isLatest && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                              }`}>
                                Latest
                              </span>
                            )}
                            {/* Label */}
                            {v.label && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-50 text-purple-700'
                              }`}>
                                {v.label}
                              </span>
                            )}
                            {/* Timestamp */}
                            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
                              {formatDate(v.created_at)}
                            </span>
                          </div>

                          <p className={`text-xs mt-1 truncate ${isDark ? 'text-neutral-400' : 'text-[#5c574e]'}`}>
                            {v.title}
                          </p>

                          {/* Restore button (visible on hover) */}
                          {!isLatest && (
                            <button
                              onClick={() => setRestoreConfirmId(v.id)}
                              className={`mt-1.5 flex items-center gap-1 text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:scale-105 active:scale-95 ${
                                isDark
                                  ? 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                                  : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#ebe8e2]'
                              }`}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                              </svg>
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Load more */}
                  {hasMore && (
                    <div className="pt-2 pl-9">
                      <button
                        onClick={loadMore}
                        disabled={isLoading}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${
                          isDark
                            ? 'text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700'
                            : 'text-[#5c574e] hover:text-[#2d2a26] bg-[#f5f2ed] hover:bg-[#ebe8e2]'
                        }`}
                      >
                        {isLoading ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Restore confirmation dialog */}
          <AnimatePresence>
            {restoreConfirmId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[55] flex items-center justify-center"
              >
                <div className="absolute inset-0 bg-black/30" onClick={() => setRestoreConfirmId(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className={`relative w-full max-w-xs mx-4 rounded-xl border p-4 shadow-xl ${
                    isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#e8e4dc]'
                  }`}
                >
                  <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-[#2d2a26]'}`}>
                    Restore Version
                  </h3>
                  <p className={`text-xs mb-3 ${isDark ? 'text-neutral-400' : 'text-[#5c574e]'}`}>
                    This will replace the current document content with this version. A new snapshot will be created automatically.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setRestoreConfirmId(null)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105 active:scale-95 ${
                        isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-[#5c574e] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRestore(restoreConfirmId)}
                      disabled={isRestoring}
                      className="px-3 py-1.5 text-xs rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {isRestoring ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  )
}
