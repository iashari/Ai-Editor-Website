'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseClient } from '@/lib/supabaseClient'

interface SharedDocument {
  id: string
  title: string
  content: string
  updated_at: string
}

type PageState = 'loading' | 'ready' | 'error'

export default function SharedDocumentPage() {
  const { token } = useParams<{ token: string }>()
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<PageState>('loading')
  const [document, setDocument] = useState<SharedDocument | null>(null)
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [errorTitle, setErrorTitle] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const saveTimeoutRef = useRef<NodeJS.Timeout>(undefined)

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

  if (state === 'loading' || authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-neutral-700 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">Loading shared document...</p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center max-w-sm mx-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{errorTitle}</h1>
          <p className="text-neutral-400 text-sm mb-6">{errorMessage}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-white text-black font-medium hover:scale-105 active:scale-95 transition-all"
          >
            Go to Editor
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Top bar */}
      <div className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <span className="text-sm font-semibold text-white tracking-tight">
              {document?.title || 'Shared Document'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              permission === 'edit'
                ? 'bg-blue-500/15 text-blue-400'
                : 'bg-neutral-800 text-neutral-400'
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
            {permission === 'edit' && !user && (
              <Link href="/" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Sign in to edit
              </Link>
            )}
            <Link
              href="/"
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Open Editor
            </Link>
          </div>
        </div>
      </div>

      {/* Document content */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        {canEdit ? (
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setSaveStatus('saving') }}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
              }
            }}
            className="w-full min-h-[calc(100vh-8rem)] bg-transparent text-neutral-100 text-sm leading-relaxed resize-none outline-none font-[family-name:var(--font-geist-mono)]"
            placeholder="Start writing..."
          />
        ) : (
          <div className="text-neutral-200 text-sm leading-relaxed whitespace-pre-wrap font-[family-name:var(--font-geist-mono)]">
            {content || <span className="text-neutral-600 italic">This document is empty.</span>}
          </div>
        )}
      </div>
    </div>
  )
}
