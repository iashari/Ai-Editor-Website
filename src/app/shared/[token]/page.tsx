'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useRealtimeDocument } from '@/hooks/useRealtimeDocument'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useThrottle } from '@/hooks/useThrottle'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import CursorOverlay from '@/components/CursorOverlay'
import LiveCursors from '@/components/LiveCursors'
import PresenceIndicator from '@/components/PresenceIndicator'

interface SharedDocument {
  id: string
  title: string
  content: string
  updated_at: string
}

type PageState = 'loading' | 'ready' | 'error'

export default function SharedDocumentPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<PageState>('loading')
  const [document, setDocument] = useState<SharedDocument | null>(null)
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [errorTitle, setErrorTitle] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const saveTimeoutRef = useRef<NodeJS.Timeout>(undefined)
  const [isDark, setIsDark] = useState(true)
  const isReceivingRemoteRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)

  // Sync html dark class with local isDark state
  useEffect(() => {
    const html = globalThis.document?.documentElement
    if (!html) return
    if (isDark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    // Restore dark class on unmount (since the main editor expects it)
    return () => { html.classList.add('dark') }
  }, [isDark])

  useEffect(() => {
    if (!token) return
    fetchSharedDocument()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function fetchSharedDocument() {
    try {
      const res = await fetch(`/api/shared/${token}`)
      const data = await res.json()

      if (!res.ok) {
        setErrorTitle(data.error || 'Error')
        setErrorMessage(data.message || 'Something went wrong')
        setState('error')
        return
      }

      setDocument(data.document)
      setPermission(data.permission)
      setContent(data.document.content)
      setState('ready')
    } catch (err) {
      setErrorTitle('Connection Error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load shared document')
      setState('error')
    }
  }

  const handleSave = useCallback(async () => {
    if (!document || permission !== 'edit' || !user) return
    try {
      setSaveStatus('saving')
      const { error } = await getSupabaseClient()
        .from('documents')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', document.id)
      setSaveStatus(error ? 'error' : 'saved')
    } catch (err) {
      if (err instanceof Error) console.error('Save failed:', err.message)
      setSaveStatus('error')
    }
  }, [document, permission, user, content])

  // Auto-save after 2s of no typing
  useEffect(() => {
    if (!document || permission !== 'edit' || !user) return
    if (content === document.content) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSaveStatus('saving')
    saveTimeoutRef.current = setTimeout(() => { handleSave() }, 2000)

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const canEdit = permission === 'edit' && !!user

  // Real-time collaboration: sync changes from other users via postgres_changes
  const handleRealtimeUpdate = useCallback((newContent: string) => {
    setContent((prev) => {
      if (prev === newContent) return prev
      return newContent
    })
  }, [])
  useRealtimeDocument(document?.id ?? null, handleRealtimeUpdate)

  // Presence + broadcast collaboration
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonymous'

  const {
    collaborators,
    typingUsers,
    isConnected: isCollabConnected,
    broadcastContentChange,
    updateCursor,
    updateMouse,
  } = useCollaboration({
    documentId: document?.id ?? null,
    userId: user?.id || `anon-${token?.slice(0, 8)}`,
    displayName,
    onContentChange: useCallback((newContent: string) => {
      isReceivingRemoteRef.current = true
      setContent(newContent)
    }, []),
  })

  const throttledCursorUpdate = useThrottle((line: number, col: number) => {
    updateCursor(line, col)
  }, 50)

  const emitCursor = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const pos = textarea.selectionStart
    const textBefore = textarea.value.substring(0, pos)
    const lines = textBefore.split('\n')
    throttledCursorUpdate(lines.length, lines[lines.length - 1].length)
  }, [throttledCursorUpdate])

  const debouncedBroadcast = useDebouncedCallback(
    (text: string) => broadcastContentChange(text),
    300
  )

  // Redirect to login if edit permission but not logged in
  useEffect(() => {
    if (state === 'ready' && permission === 'edit' && !authLoading && !user) {
      router.push(`/?returnUrl=/shared/${token}`)
    }
  }, [state, permission, authLoading, user, token, router])

  if (state === 'loading' || authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-950' : 'bg-[#faf8f5]'}`}>
        <div className="text-center">
          <div className={`w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4 ${isDark ? 'border-neutral-700 border-t-white' : 'border-[#d5d0c8] border-t-[#2d2a26]'}`} />
          <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-[#9c958a]'}`}>Loading shared document...</p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-950' : 'bg-[#faf8f5]'}`}>
        <div className="text-center max-w-sm mx-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? 'text-red-400' : 'text-red-500'}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-[#2d2a26]'}`}>{errorTitle}</h1>
          <p className={`text-sm mb-6 ${isDark ? 'text-neutral-400' : 'text-[#9c958a]'}`}>{errorMessage}</p>
          <Link
            href="/"
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-medium hover:scale-105 active:scale-95 transition-all ${isDark ? 'bg-white text-black' : 'bg-[#2d2a26] text-white'}`}
          >
            Go to Editor
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div ref={pageContainerRef} className={`min-h-screen flex flex-col transition-colors duration-300 relative ${isDark ? 'bg-neutral-950' : 'bg-[#faf8f5]'}`}>
      <LiveCursors
        collaborators={collaborators}
        onMouseMove={updateMouse}
        containerRef={pageContainerRef}
        isDark={isDark}
      />
      {/* Top bar */}
      <div className={`border-b backdrop-blur-md transition-colors duration-300 ${isDark ? 'border-neutral-800 bg-neutral-950/80' : 'border-[#e8e4dc] bg-[#faf8f5]/80'}`}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? 'text-neutral-500' : 'text-[#9c958a]'}>
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <span className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-[#2d2a26]'}`}>
              {document?.title || 'Shared Document'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              permission === 'edit'
                ? 'bg-blue-500/15 text-blue-400'
                : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-[#f5f2ed] text-[#5c574e]'
            }`}>
              {permission === 'edit' ? 'Can Edit' : 'View Only'}
            </span>
            {canEdit && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                saveStatus === 'saved'
                  ? 'bg-green-500/10 text-green-400'
                  : saveStatus === 'saving'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
              }`}>
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Error'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Presence indicator */}
            <PresenceIndicator
              collaborators={collaborators}
              typingUsers={typingUsers}
              isConnected={isCollabConnected}
              isDark={isDark}
            />
            {/* Theme toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f0ede8]'}`}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              )}
            </button>
            <Link
              href={document ? `/?openDoc=${document.id}` : '/'}
              className={`text-xs transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-[#9c958a] hover:text-[#2d2a26]'}`}
            >
              Open Editor
            </Link>
          </div>
        </div>
      </div>

      {/* Document content */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        {canEdit ? (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                const newVal = e.target.value
                setContent(newVal)
                setSaveStatus('saving')
                if (!isReceivingRemoteRef.current) {
                  debouncedBroadcast(newVal)
                }
                isReceivingRemoteRef.current = false
                emitCursor()
              }}
              onBlur={handleSave}
              onKeyUp={emitCursor}
              onClick={emitCursor}
              onSelect={emitCursor}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault()
                  handleSave()
                }
              }}
              className={`w-full min-h-[calc(100vh-8rem)] bg-transparent border-none text-sm resize-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-none font-[family-name:var(--font-geist-mono)] transition-colors duration-300 ${isDark ? 'text-neutral-100 placeholder:text-neutral-600' : 'text-[#2d2a26] placeholder:text-[#9c958a]'}`}
              style={{ lineHeight: '1.625rem' }}
              placeholder="Start writing..."
            />
            <CursorOverlay
              collaborators={collaborators}
              textareaRef={textareaRef}
              content={content}
              isDark={isDark}
            />
          </div>
        ) : (
          <div className={`text-sm leading-relaxed whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] transition-colors duration-300 ${isDark ? 'text-neutral-200' : 'text-[#2d2a26]'}`}>
            {content || <span className={`italic ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>This document is empty.</span>}
          </div>
        )}
      </div>
    </div>
  )
}
