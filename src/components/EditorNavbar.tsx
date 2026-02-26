'use client'

import { useState, useRef, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'
import ShareDialog from './ShareDialog'
import ConfirmDialog from './ConfirmDialog'
import VersionHistoryDialog from './VersionHistoryDialog'
import PresenceIndicator from './PresenceIndicator'
import { motion, AnimatePresence } from './animations/MotionDiv'
import type { CollaboratorPresence } from '@/hooks/useCollaboration'

interface Document {
  id: string
  title: string
  content: string
}

interface EditorNavbarProps {
  docTitle: string
  setDocTitle: (title: string) => void
  currentDocId: string | null
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved' | 'error') => void
  isDark: boolean
  setIsDark: (dark: boolean) => void
  onThemeToggle?: (e: React.MouseEvent) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  documents: Document[]
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>
  onCreateDocument: () => void
  onSelectDocument: (doc: Document) => void
  onDeleteDocument: (docId: string) => void
  onExport: (format: 'txt' | 'md' | 'html' | 'doc' | 'pdf') => void
  onSignOut: () => void
  displayName: string
  userEmail: string
  userId: string
  onSidebarToggle?: () => void
  showSidebar?: boolean
  onVersionRestore?: (content: string, title: string) => void
  collaborators?: CollaboratorPresence[]
  typingUsers?: string[]
  isCollabConnected?: boolean
}

export default function EditorNavbar({
  docTitle,
  setDocTitle,
  currentDocId,
  saveStatus,
  setSaveStatus,
  isDark,
  setIsDark,
  onThemeToggle,
  undo,
  redo,
  canUndo,
  canRedo,
  documents,
  setDocuments,
  onCreateDocument,
  onSelectDocument,
  onDeleteDocument,
  onExport,
  onSignOut,
  displayName,
  userEmail,
  userId,
  onSidebarToggle,
  showSidebar,
  onVersionRestore,
  collaborators = [],
  typingUsers = [],
  isCollabConnected = false,
}: EditorNavbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showFileNav, setShowFileNav] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const fileNavRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false)
      if (fileNavRef.current && !fileNavRef.current.contains(e.target as Node)) setShowFileNav(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function startEditingName() {
    setEditNameValue(displayName)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }

  async function saveDisplayName() {
    const trimmed = editNameValue.trim()
    if (!trimmed || trimmed === displayName) {
      setEditingName(false)
      return
    }
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ data: { full_name: trimmed } })
      if (!error) {
        // Parent will pick up the new name from auth state
      }
    } catch (err) {
      if (err instanceof Error) console.error('Failed to update name:', err.message)
    }
    setEditingName(false)
  }

  const dropdownVariants = {
    initial: { opacity: 0, y: 8, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 6, scale: 0.97 },
  }

  const dropdownTransition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }

  return (
    <>
    <div className="relative">
      <div className="absolute inset-0 backdrop-blur-md" style={{ backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(250, 248, 245, 0.85)', borderBottom: `1px solid ${isDark ? 'rgba(38, 38, 38, 0.5)' : 'rgba(232, 228, 220, 0.6)'}` }} />
      <div className="relative flex items-center justify-between px-6 h-14">
        {/* Left - Sidebar toggle + Title */}
        <div className="flex items-center gap-3">
          {onSidebarToggle && (
            <button
              onClick={onSidebarToggle}
              className={`p-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`}
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
          <input
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
            onBlur={async () => {
              if (!currentDocId) return
              try {
                setSaveStatus('saving')
                const { error } = await getSupabaseClient().from('documents').update({ title: docTitle, updated_at: new Date().toISOString() }).eq('id', currentDocId)
                setDocuments((prev) => prev.map((d) => d.id === currentDocId ? { ...d, title: docTitle } : d))
                setSaveStatus(error ? 'error' : 'saved')
              } catch (err) {
                if (err instanceof Error) console.error('Title save failed:', err.message)
                setSaveStatus('error')
              }
            }}
            className={`text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-1 rounded-lg px-2 py-1 tracking-tight ${isDark ? 'text-neutral-100 focus:ring-neutral-600' : 'text-[#2d2a26] focus:ring-[#e8e4dc]'}`}
            style={{ minWidth: '120px' }}
          />
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            saveStatus === 'saved'
              ? isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'
              : saveStatus === 'saving'
                ? isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                : saveStatus === 'error'
                  ? isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700'
                  : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-[#f5f2ed] text-[#9c958a]'
          }`}>
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error saving' : 'Unsaved'}
          </span>
        </div>

        {/* Center-left - Presence */}
        <div className="hidden lg:flex items-center">
          <PresenceIndicator
            collaborators={collaborators}
            typingUsers={typingUsers}
            isConnected={isCollabConnected}
            isDark={isDark}
          />
        </div>

        {/* Center - Tool buttons */}
        <div className={`hidden md:flex items-center gap-0.5 px-1.5 py-1 rounded-2xl border ${isDark ? 'bg-[rgba(10,10,10,0.6)] border-[rgba(38,38,38,0.8)]' : 'bg-[rgba(250,248,245,0.8)] border-[rgba(232,228,220,0.8)]'}`}>
          <button onClick={undo} disabled={!canUndo} className={`p-2 rounded-xl transition-all duration-300 disabled:opacity-20 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Undo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
          <button onClick={redo} disabled={!canRedo} className={`p-2 rounded-xl transition-all duration-300 disabled:opacity-20 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Redo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
          </button>
          <button onClick={() => setShowVersionHistory(true)} disabled={!currentDocId} className={`p-2 rounded-xl transition-all duration-300 disabled:opacity-20 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Version History">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button onClick={() => setShowExportMenu(!showExportMenu)} className={`p-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Export">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  variants={dropdownVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={dropdownTransition}
                  className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 w-44 rounded-xl border shadow-lg overflow-hidden z-50 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-[#f5f2ed] border-[#d5d0c8]'}`}
                >
                  <p className={`px-3 py-2 text-xs font-medium tracking-wide ${isDark ? 'text-neutral-500 border-b border-neutral-800' : 'text-[#9c958a] border-b border-[#e8e4dc]'}`}>Export as</p>
                  {([
                    { format: 'txt' as const, label: 'Plain Text', ext: '.txt' },
                    { format: 'md' as const, label: 'Markdown', ext: '.md' },
                    { format: 'html' as const, label: 'HTML', ext: '.html' },
                    { format: 'doc' as const, label: 'Word Document', ext: '.doc' },
                    { format: 'pdf' as const, label: 'PDF', ext: '.pdf' },
                  ]).map((opt) => (
                    <button
                      key={opt.format}
                      onClick={() => { onExport(opt.format); setShowExportMenu(false) }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${isDark ? 'text-neutral-300 hover:bg-neutral-800' : 'text-[#2d2a26] hover:bg-[#f5f2ed]'}`}
                    >
                      <span>{opt.label}</span>
                      <span className={`text-xs ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>{opt.ext}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative" ref={fileNavRef}>
            <button onClick={() => setShowFileNav(!showFileNav)} className={`p-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Documents">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            </button>
            <AnimatePresence>
              {showFileNav && (
                <motion.div
                  variants={dropdownVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={dropdownTransition}
                  className={`absolute top-full mt-2 right-0 w-64 rounded-xl border shadow-lg overflow-hidden z-50 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-[#f5f2ed] border-[#d5d0c8]'}`}
                >
                  <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
                    <p className={`text-xs font-medium tracking-wide ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>Documents ({documents.length})</p>
                    <button
                      onClick={() => { onCreateDocument(); setShowFileNav(false) }}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95"
                      style={{ backgroundColor: isDark ? '#ffffff' : '#2d2a26', color: isDark ? '#000000' : '#ffffff' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      New
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className={`flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer group ${
                          doc.id === currentDocId
                            ? isDark ? 'bg-neutral-800/60' : 'bg-[#f5f2ed]'
                            : isDark ? 'hover:bg-neutral-800/40' : 'hover:bg-[#faf8f5]'
                        }`}
                        onClick={() => { onSelectDocument(doc); setShowFileNav(false) }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${doc.id === currentDocId ? (isDark ? 'text-white' : 'text-[#2d2a26]') : (isDark ? 'text-neutral-600' : 'text-[#9c958a]')}`}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                          <span className={`text-sm truncate ${doc.id === currentDocId ? (isDark ? 'text-white font-medium' : 'text-[#2d2a26] font-medium') : (isDark ? 'text-neutral-400' : 'text-[#5c574e]')}`}>
                            {doc.title}
                          </span>
                        </div>
                        {documents.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(doc.id); setShowFileNav(false) }}
                            className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all ${isDark ? 'text-neutral-600 hover:text-red-400 hover:bg-neutral-700' : 'text-[#9c958a] hover:text-red-500 hover:bg-red-50'}`}
                            title="Delete"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {documents.length === 0 && (
                      <p className={`text-center py-6 text-sm ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>No documents yet</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => currentDocId && setShowShareDialog(true)}
            disabled={!currentDocId}
            className={`p-2 rounded-xl transition-all duration-300 disabled:opacity-20 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`}
            title="Share"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
          </button>
        </div>

        {/* Right - Theme + User */}
        <div className="flex items-center gap-3">
          <button onClick={(e) => onThemeToggle ? onThemeToggle(e) : setIsDark(!isDark)} className="relative rounded-full transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden" style={{ width: 48, height: 24, backgroundColor: isDark ? '#262626' : '#e5e5e5' }} title="Toggle theme">
            <div className="absolute rounded-full shadow-md transition-transform duration-300 flex items-center justify-center" style={{ width: 16, height: 16, top: 4, left: 4, transform: `translateX(${isDark ? 0 : 24}px)`, backgroundColor: isDark ? '#ffffff' : '#171717' }}>
              <svg className="absolute transition-all duration-300" style={{ width: 8, height: 8, opacity: isDark ? 0 : 1, color: '#ffffff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <svg className="absolute transition-all duration-300" style={{ width: 8, height: 8, opacity: isDark ? 1 : 0, color: '#171717' }} fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            </div>
          </button>
          <div className={`w-px h-5 ${isDark ? 'bg-neutral-800' : 'bg-[#e8e4dc]'}`} />
          {editingName ? (
            <input
              ref={nameInputRef}
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setEditingName(false) }}
              onBlur={saveDisplayName}
              className={`text-xs tracking-wide w-24 px-1.5 py-0.5 rounded-md border outline-none ${isDark ? 'bg-neutral-800 text-white border-neutral-600 focus:border-neutral-400' : 'bg-[#f5f2ed] text-[#2d2a26] border-[#d5d0c8] focus:border-[#9c958a]'}`}
              maxLength={30}
              autoFocus
            />
          ) : (
            <button onClick={startEditingName} className={`text-xs tracking-wide hover:underline cursor-pointer ${isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-[#9c958a] hover:text-[#5c574e]'}`} title="Click to edit name">
              {displayName || userEmail.split('@')[0]}
            </button>
          )}
          <button onClick={onSignOut} className={`text-xs tracking-wide px-3 py-1.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#5c574e] hover:bg-[#f5f2ed]'}`}>Sign Out</button>
        </div>
      </div>
    </div>

    {currentDocId && (
      <ShareDialog
        open={showShareDialog}
        documentId={currentDocId}
        ownerId={userId}
        isDark={isDark}
        onClose={() => setShowShareDialog(false)}
        documents={documents}
      />
    )}

    <ConfirmDialog
      open={!!deleteConfirmId}
      title="Delete Document"
      message="Are you sure you want to delete this document? This action cannot be undone."
      isDark={isDark}
      onConfirm={() => { if (deleteConfirmId) onDeleteDocument(deleteConfirmId); setDeleteConfirmId(null) }}
      onCancel={() => setDeleteConfirmId(null)}
    />

    {currentDocId && (
      <VersionHistoryDialog
        open={showVersionHistory}
        documentId={currentDocId}
        isDark={isDark}
        onClose={() => setShowVersionHistory(false)}
        onRestore={(content, title) => { if (onVersionRestore) onVersionRestore(content, title) }}
      />
    )}
    </>
  )
}
