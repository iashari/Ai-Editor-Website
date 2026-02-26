'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from './animations/MotionDiv'
import { getVersions, deleteVersion, type DocumentVersion } from '@/lib/versionHistory'

interface Props {
  open: boolean
  documentId: string
  isDark: boolean
  onClose: () => void
  onRestore: (content: string, title: string) => void
}

export default function VersionHistoryDialog({ open, documentId, isDark, onClose, onRestore }: Props) {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getVersions(documentId)
      .then((data) => { if (!cancelled) setVersions(data) })
      .catch((err) => console.error('Failed to load versions:', err?.message || err))
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [open, documentId])

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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }

  function wordCount(text: string) {
    return text.trim() ? text.trim().split(/\s+/).length : 0
  }

  async function handleDelete(versionId: string) {
    try {
      await deleteVersion(versionId)
      setVersions((prev) => prev.filter((v) => v.id !== versionId))
      if (previewId === versionId) setPreviewId(null)
    } catch (err) {
      console.error('Failed to delete version:', err)
    }
  }

  const previewVersion = versions.find((v) => v.id === previewId)

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
            className={`relative w-full max-w-2xl mx-4 rounded-xl border shadow-xl flex flex-col ${
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
              <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Version list */}
              <div className={`w-64 shrink-0 overflow-y-auto border-r ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
                {isLoading ? (
                  <div className="p-4 text-center">
                    <div className={`w-6 h-6 mx-auto mb-2 border-2 rounded-full animate-spin ${isDark ? 'border-neutral-700 border-t-neutral-400' : 'border-[#d5d0c8] border-t-[#9c958a]'}`} />
                    <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>Loading...</p>
                  </div>
                ) : versions.length === 0 ? (
                  <div className={`p-4 text-center ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-50"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    <p className="text-xs">No versions saved yet.</p>
                    <p className="text-xs mt-1 opacity-70">Versions are saved when you manually save (Ctrl+S).</p>
                  </div>
                ) : (
                  versions.map((v, i) => (
                    <div
                      key={v.id}
                      onClick={() => setPreviewId(v.id)}
                      className={`group px-3 py-2.5 cursor-pointer transition-all duration-200 border-b ${
                        previewId === v.id
                          ? isDark ? 'bg-neutral-800/60 border-neutral-700' : 'bg-[#f0ede8] border-[#e8e4dc]'
                          : isDark ? 'hover:bg-neutral-800/30 border-neutral-800/50' : 'hover:bg-[#f5f2ed] border-[#e8e4dc]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-[#2d2a26]'}`}>
                          {i === 0 ? 'Latest' : formatDate(v.created_at)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(v.id) }}
                          className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all ${isDark ? 'text-neutral-600 hover:text-red-400' : 'text-[#9c958a] hover:text-red-500'}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
                        {v.title}
                      </p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-600' : 'text-[#9c958a]/70'}`}>
                        {wordCount(v.content)} words
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Preview panel */}
              <div className="flex-1 overflow-y-auto flex flex-col">
                {previewVersion ? (
                  <>
                    <div className={`px-4 py-2 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
                      <div>
                        <p className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-[#2d2a26]'}`}>{previewVersion.title}</p>
                        <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
                          {new Date(previewVersion.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => { onRestore(previewVersion.content, previewVersion.title); onClose() }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-black hover:scale-105 active:scale-95 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                        Restore
                      </button>
                    </div>
                    <pre className={`flex-1 p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono ${isDark ? 'text-neutral-300' : 'text-[#2d2a26]'}`}>
                      {previewVersion.content || '(empty)'}
                    </pre>
                  </>
                ) : (
                  <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>
                    <p className="text-xs">Select a version to preview</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
