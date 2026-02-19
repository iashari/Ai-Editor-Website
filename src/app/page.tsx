'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import DocumentEditor from '@/components/DocumentEditor'
import AIChat from '@/components/AIChat'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useRealtimeDocument } from '@/hooks/useRealtimeDocument'
import type { User } from '@supabase/supabase-js'

function useHistory(initialContent: string) {
  const [history, setHistory] = useState<string[]>([initialContent])
  const [index, setIndex] = useState(0)
  const isUndoRedoRef = useRef(false)
  const current = history[index] ?? ''

  const push = useCallback(
    (content: string) => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false
        return
      }
      setHistory((prev) => {
        const newHistory = [...prev.slice(0, index + 1), content]
        if (newHistory.length > 100) newHistory.shift()
        return newHistory
      })
      setIndex((prev) => Math.min(prev + 1, 99))
    },
    [index]
  )

  const undo = useCallback(() => {
    if (index > 0) {
      isUndoRedoRef.current = true
      setIndex((prev) => prev - 1)
    }
  }, [index])

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      isUndoRedoRef.current = true
      setIndex((prev) => prev + 1)
    }
  }, [index, history.length])

  return { current, push, undo, redo, canUndo: index > 0, canRedo: index < history.length - 1 }
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' }
  if (score <= 2) return { score, label: 'Fair', color: '#f97316' }
  if (score <= 3) return { score, label: 'Good', color: '#eab308' }
  return { score, label: 'Strong', color: '#22c55e' }
}

interface Document {
  id: string
  title: string
  content: string
}

export default function EditorPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authFullName, setAuthFullName] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [authSuccess, setAuthSuccess] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [currentDocId, setCurrentDocId] = useState<string | null>(null)
  const [docTitle, setDocTitle] = useState('Untitled Document')
  const [isDark, setIsDark] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const { current: documentContent, push: pushHistory, undo, redo, canUndo, canRedo } = useHistory('')
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showFileNav, setShowFileNav] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [editNameValue, setEditNameValue] = useState('')
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const fileNavRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setDisplayName(u?.user_metadata?.full_name || u?.email?.split('@')[0] || '')
      setAuthLoading(false)
    })
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      setDisplayName(u?.user_metadata?.full_name || u?.email?.split('@')[0] || '')
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    loadDocuments()
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) emailInputRef.current?.focus()
  }, [authLoading, user, authMode])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false)
      if (fileNavRef.current && !fileNavRef.current.contains(e.target as Node)) setShowFileNav(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadDocuments() {
    const { data } = await getSupabaseClient().from('documents').select('id, title, content').order('updated_at', { ascending: false })
    if (data && data.length > 0) {
      setDocuments(data)
      setCurrentDocId(data[0].id)
      setDocTitle(data[0].title)
      pushHistory(data[0].content)
    }
  }

  async function createNewDocument() {
    if (!user) return
    const { data, error } = await getSupabaseClient().from('documents').insert({ user_id: user.id, title: 'Untitled Document', content: '' }).select().single()
    if (data && !error) {
      setDocuments((prev) => [data, ...prev])
      setCurrentDocId(data.id)
      setDocTitle(data.title)
      pushHistory(data.content)
    }
  }

  async function selectDocument(doc: Document) {
    setCurrentDocId(doc.id)
    setDocTitle(doc.title)
    pushHistory(doc.content)
    setShowFileNav(false)
  }

  async function deleteDocument(docId: string) {
    if (documents.length <= 1) return
    await getSupabaseClient().from('documents').delete().eq('id', docId)
    const remaining = documents.filter((d) => d.id !== docId)
    setDocuments(remaining)
    if (currentDocId === docId && remaining.length > 0) {
      selectDocument(remaining[0])
    }
  }

  useAutoSave(currentDocId, documentContent)
  useRealtimeDocument(currentDocId, (content) => pushHistory(content))

  const handleContentChange = useCallback((newContent: string) => {
    pushHistory(newContent)
    setSaveStatus('unsaved')
    setTimeout(() => setSaveStatus('saved'), 2500)
  }, [pushHistory])

  const handleAIUpdate = useCallback((newContent: string) => {
    pushHistory(newContent)
    setSaveStatus('unsaved')
    setTimeout(() => setSaveStatus('saved'), 2500)
  }, [pushHistory])

  const handleSave = useCallback(async () => {
    if (!currentDocId) return
    setSaveStatus('saving')
    await getSupabaseClient().from('documents').update({ content: documentContent, title: docTitle, updated_at: new Date().toISOString() }).eq('id', currentDocId)
    setSaveStatus('saved')
  }, [currentDocId, documentContent, docTitle])

  function exportAs(format: 'txt' | 'md' | 'html' | 'doc' | 'pdf') {
    const title = docTitle || 'document'
    const content = documentContent || ''
    setShowExportMenu(false)

    if (format === 'txt') {
      const blob = new Blob([content], { type: 'text/plain' })
      downloadBlob(blob, `${title}.txt`)
    } else if (format === 'md') {
      const blob = new Blob([content], { type: 'text/markdown' })
      downloadBlob(blob, `${title}.md`)
    } else if (format === 'html') {
      const lines = content.split('\n')
      const htmlBody = lines.map((line) => {
        if (!line.trim()) return '<br/>'
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
        if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
        return `<p>${line}</p>`
      }).join('\n')
      const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${title}</title>\n<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#1a1a1a}h1,h2,h3{margin-top:1.5em}p{margin:0.5em 0}</style>\n</head>\n<body>\n${htmlBody}\n</body>\n</html>`
      const blob = new Blob([html], { type: 'text/html' })
      downloadBlob(blob, `${title}.html`)
    } else if (format === 'doc') {
      const lines = content.split('\n')
      const htmlBody = lines.map((line) => {
        if (!line.trim()) return '<br/>'
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
        if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
        return `<p>${line}</p>`
      }).join('\n')
      const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a;margin:2cm}h1{font-size:20pt;font-weight:700;margin:16px 0 8px}h2{font-size:16pt;font-weight:600;margin:14px 0 6px}h3{font-size:13pt;font-weight:600;margin:12px 0 4px}p{margin:4px 0}</style></head><body>${htmlBody}</body></html>`
      const blob = new Blob(['\ufeff' + doc], { type: 'application/msword' })
      downloadBlob(blob, `${title}.doc`)
    } else if (format === 'pdf') {
      const lines = content.split('\n')
      const htmlBody = lines.map((line) => {
        if (!line.trim()) return '<br/>'
        if (line.startsWith('# ')) return `<h1 style="font-size:24px;font-weight:700;margin:16px 0 8px">${line.slice(2)}</h1>`
        if (line.startsWith('## ')) return `<h2 style="font-size:20px;font-weight:600;margin:14px 0 6px">${line.slice(3)}</h2>`
        if (line.startsWith('### ')) return `<h3 style="font-size:16px;font-weight:600;margin:12px 0 4px">${line.slice(4)}</h3>`
        return `<p style="margin:4px 0;line-height:1.7">${line}</p>`
      }).join('\n')
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>@page{margin:2cm}body{font-family:system-ui,-apple-system,sans-serif;max-width:100%;color:#1a1a1a;font-size:12pt}</style></head><body>${htmlBody}</body></html>`)
        printWindow.document.close()
        setTimeout(() => { printWindow.print() }, 300)
      }
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function validateField(field: string, value: string) {
    const errors = { ...fieldErrors }
    if (field === 'email') {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.email = 'Please enter a valid email address'
      else delete errors.email
    }
    if (field === 'password') {
      if (value && value.length < 6) errors.password = 'Password must be at least 6 characters'
      else delete errors.password
      if (authConfirmPassword && value !== authConfirmPassword) errors.confirmPassword = 'Passwords do not match'
      else delete errors.confirmPassword
    }
    if (field === 'confirmPassword') {
      if (value && value !== authPassword) errors.confirmPassword = 'Passwords do not match'
      else delete errors.confirmPassword
    }
    if (field === 'fullName') {
      if (authMode === 'signup' && value && value.trim().length < 2) errors.fullName = 'Please enter your full name'
      else delete errors.fullName
    }
    setFieldErrors(errors)
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')

    if (authMode === 'signup') {
      if (authPassword !== authConfirmPassword) {
        setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }))
        return
      }
      if (authFullName.trim().length < 2) {
        setFieldErrors((prev) => ({ ...prev, fullName: 'Please enter your full name' }))
        return
      }
    }

    setAuthSubmitting(true)
    try {
      if (authMode === 'signup') {
        const { error } = await getSupabaseClient().auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { full_name: authFullName.trim() } },
        })
        if (error) { setAuthError(error.message) }
      } else {
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email: authEmail, password: authPassword })
        if (error) setAuthError(error.message)
      }
    } catch {
      setAuthError('An unexpected error occurred. Please try again.')
    } finally {
      setAuthSubmitting(false)
    }
  }

  async function handleSignOut() {
    await getSupabaseClient().auth.signOut()
    setDocuments([])
    setCurrentDocId(null)
    pushHistory('')
  }

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
    const { error } = await getSupabaseClient().auth.updateUser({ data: { full_name: trimmed } })
    if (!error) {
      setDisplayName(trimmed)
    }
    setEditingName(false)
  }

  function switchAuthMode(mode: 'login' | 'signup') {
    setAuthMode(mode)
    setAuthError('')
    setAuthSuccess('')
    setFieldErrors({})
    setShowPassword(false)
    setShowConfirmPassword(false)
    if (mode === 'login') {
      setAuthFullName('')
      setAuthConfirmPassword('')
    }
  }

  const passwordStrength = getPasswordStrength(authPassword)

  // Loading
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        <div className="fixed inset-0 bg-gradient-to-b from-neutral-950 via-transparent to-neutral-950 pointer-events-none" />
        <div className="relative z-10 text-center">
          <div className="w-10 h-10 border-2 border-neutral-700 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm tracking-wide">Loading editor...</p>
        </div>
      </div>
    )
  }

  // Auth screen
  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 relative overflow-hidden">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        <div className="fixed inset-0 bg-gradient-to-b from-neutral-950 via-transparent to-neutral-950 pointer-events-none" />

        <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
          {/* Left panel - Branding */}
          <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
            <div className="max-w-md w-full">
              <div className="animate-fade-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                <span className="text-neutral-500 text-sm tracking-widest uppercase mb-4 block">
                  AI-Powered
                </span>
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight leading-tight">
                  Document
                  <br />
                  <span className="text-neutral-400">Editor</span><span className="text-neutral-500">.</span>
                </h1>
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                <div className="w-16 h-px bg-neutral-700 my-6" />
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
                <p className="text-neutral-400 text-lg leading-relaxed mb-8">
                  Write, edit, and collaborate with AI assistance. A smart document editor powered by Gemini that understands your content and helps you create better documents.
                </p>
              </div>

              <div className="animate-fade-in-up space-y-4" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                {[
                  { title: 'AI-Powered Editing', desc: 'Smart document manipulation with natural language' },
                  { title: 'Real-time Sync', desc: 'Auto-save and live collaboration ready' },
                  { title: 'Multimodal Support', desc: 'Upload images, PDFs, and documents for AI analysis' },
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0 group-hover:bg-neutral-400 transition-colors duration-300" />
                    <div>
                      <p className="text-white text-sm font-medium tracking-tight">{feature.title}</p>
                      <p className="text-neutral-500 text-sm">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel - Auth form */}
          <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
            <div className="animate-scale-in w-full max-w-md" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-2xl blur opacity-20" />

                <div className="relative bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 backdrop-blur-sm">
                  {/* Mode tabs */}
                  <div className="flex mb-8 bg-neutral-800/50 rounded-full p-1">
                    <button
                      type="button"
                      onClick={() => switchAuthMode('login')}
                      className={`flex-1 py-2.5 text-sm font-medium tracking-wide rounded-full transition-all duration-300 ${authMode === 'login' ? 'bg-white text-black' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => switchAuthMode('signup')}
                      className={`flex-1 py-2.5 text-sm font-medium tracking-wide rounded-full transition-all duration-300 ${authMode === 'signup' ? 'bg-white text-black' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                      Create Account
                    </button>
                  </div>

                  <h2 className="text-xl font-bold text-white tracking-tight mb-1">
                    {authMode === 'login' ? 'Welcome back' : 'Create your account'}
                  </h2>
                  <p className="text-neutral-500 text-sm mb-6">
                    {authMode === 'login'
                      ? 'Enter your credentials to access your documents'
                      : 'Fill in the details below to get started'}
                  </p>

                  {authSuccess && (
                    <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm leading-relaxed">
                      {authSuccess}
                    </div>
                  )}

                  {authError && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed">
                      {authError}
                    </div>
                  )}

                  <form onSubmit={handleAuth} className="space-y-4">
                    {authMode === 'signup' && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1.5 tracking-wide">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={authFullName}
                          onChange={(e) => { setAuthFullName(e.target.value); validateField('fullName', e.target.value) }}
                          onBlur={(e) => validateField('fullName', e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-neutral-800/50 text-white placeholder-neutral-600 ${fieldErrors.fullName ? 'border-red-500/50 focus:ring-red-500/30' : 'border-neutral-700 focus:ring-neutral-500 focus:border-neutral-600'}`}
                          placeholder="Enter your full name"
                          autoComplete="name"
                          required
                        />
                        {fieldErrors.fullName && (
                          <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.fullName}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1.5 tracking-wide">
                        Email Address
                      </label>
                      <input
                        ref={emailInputRef}
                        type="email"
                        value={authEmail}
                        onChange={(e) => { setAuthEmail(e.target.value); validateField('email', e.target.value) }}
                        onBlur={(e) => validateField('email', e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-neutral-800/50 text-white placeholder-neutral-600 ${fieldErrors.email ? 'border-red-500/50 focus:ring-red-500/30' : 'border-neutral-700 focus:ring-neutral-500 focus:border-neutral-600'}`}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                      />
                      {fieldErrors.email && (
                        <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-medium text-neutral-300 tracking-wide">
                          Password
                        </label>
                        {authMode === 'login' && (
                          <button type="button" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={authPassword}
                          onChange={(e) => { setAuthPassword(e.target.value); validateField('password', e.target.value) }}
                          onBlur={(e) => validateField('password', e.target.value)}
                          className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-neutral-800/50 text-white placeholder-neutral-600 ${fieldErrors.password ? 'border-red-500/50 focus:ring-red-500/30' : 'border-neutral-700 focus:ring-neutral-500 focus:border-neutral-600'}`}
                          placeholder={authMode === 'signup' ? 'Min. 6 characters' : 'Enter your password'}
                          autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          )}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.password}</p>
                      )}

                      {authMode === 'signup' && authPassword.length > 0 && (
                        <div className="mt-2.5">
                          <div className="flex gap-1 mb-1.5">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className="h-1 flex-1 rounded-full transition-all duration-300"
                                style={{
                                  backgroundColor: level <= passwordStrength.score ? passwordStrength.color : '#262626',
                                }}
                              />
                            ))}
                          </div>
                          <p className="text-xs transition-colors" style={{ color: passwordStrength.color }}>
                            {passwordStrength.label}
                          </p>
                        </div>
                      )}
                    </div>

                    {authMode === 'signup' && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1.5 tracking-wide">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={authConfirmPassword}
                            onChange={(e) => { setAuthConfirmPassword(e.target.value); validateField('confirmPassword', e.target.value) }}
                            onBlur={(e) => validateField('confirmPassword', e.target.value)}
                            className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-neutral-800/50 text-white placeholder-neutral-600 ${fieldErrors.confirmPassword ? 'border-red-500/50 focus:ring-red-500/30' : 'border-neutral-700 focus:ring-neutral-500 focus:border-neutral-600'}`}
                            placeholder="Re-enter your password"
                            autoComplete="new-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            )}
                          </button>
                        </div>
                        {fieldErrors.confirmPassword && (
                          <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.confirmPassword}</p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authSubmitting || Object.keys(fieldErrors).length > 0}
                      className="w-full py-3 rounded-full text-sm font-bold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 bg-white text-black flex items-center justify-center gap-2"
                    >
                      {authSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
                        </>
                      ) : (
                        authMode === 'login' ? 'Sign In' : 'Create Account'
                      )}
                    </button>
                  </form>

                  {authMode === 'signup' && (
                    <p className="text-neutral-600 text-xs text-center mt-4 leading-relaxed">
                      By creating an account, you agree to our{' '}
                      <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer">Terms of Service</span>
                      {' '}and{' '}
                      <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
                    </p>
                  )}

                  <div className="mt-6 pt-6 border-t border-neutral-800">
                    <p className="text-center text-sm text-neutral-500">
                      {authMode === 'login' ? (
                        <>
                          Don&apos;t have an account?{' '}
                          <button
                            type="button"
                            onClick={() => switchAuthMode('signup')}
                            className="font-medium text-white hover:text-neutral-300 transition-colors"
                          >
                            Create one
                          </button>
                        </>
                      ) : (
                        <>
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => switchAuthMode('login')}
                            className="font-medium text-white hover:text-neutral-300 transition-colors"
                          >
                            Sign in
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main editor
  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-[#faf8f5]'}`}>
      {/* Top navbar */}
      <div className="relative">
        <div className="absolute inset-0 backdrop-blur-md" style={{ backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(250, 248, 245, 0.85)', borderBottom: `1px solid ${isDark ? 'rgba(38, 38, 38, 0.5)' : 'rgba(232, 228, 220, 0.6)'}` }} />
        <div className="relative flex items-center justify-between px-6 h-14">
          {/* Left - Title */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            </div>
            <div className={`w-px h-5 ${isDark ? 'bg-neutral-800' : 'bg-[#e8e4dc]'}`} />
            <input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className={`text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-1 rounded-lg px-2 py-1 tracking-tight ${isDark ? 'text-neutral-100 focus:ring-neutral-600' : 'text-[#2d2a26] focus:ring-[#e8e4dc]'}`}
              style={{ minWidth: '120px' }}
            />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              saveStatus === 'saved'
                ? isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'
                : saveStatus === 'saving'
                  ? isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                  : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-[#f5f2ed] text-[#9c958a]'
            }`}>
              {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
            </span>
          </div>

          {/* Center - Tool buttons */}
          <div className={`hidden md:flex items-center gap-0.5 px-1.5 py-1 rounded-2xl border ${isDark ? 'bg-[rgba(10,10,10,0.6)] border-[rgba(38,38,38,0.8)]' : 'bg-[rgba(250,248,245,0.8)] border-[rgba(232,228,220,0.8)]'}`}>
            <button onClick={undo} disabled={!canUndo} className={`p-2 rounded-xl transition-all duration-300 disabled:opacity-20 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Undo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
            <button onClick={redo} disabled={!canRedo} className={`p-2 rounded-xl transition-all duration-300 disabled:opacity-20 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Redo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} className={`p-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Export">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              {showExportMenu && (
                <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 w-44 rounded-xl border shadow-lg overflow-hidden z-50 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#e8e4dc]'}`}>
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
                      onClick={() => exportAs(opt.format)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${isDark ? 'text-neutral-300 hover:bg-neutral-800' : 'text-[#2d2a26] hover:bg-[#f5f2ed]'}`}
                    >
                      <span>{opt.label}</span>
                      <span className={`text-xs ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>{opt.ext}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative" ref={fileNavRef}>
              <button onClick={() => setShowFileNav(!showFileNav)} className={`p-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9c958a] hover:text-[#2d2a26]'}`} title="Documents">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              </button>
              {showFileNav && (
                <div className={`absolute top-full mt-2 right-0 w-64 rounded-xl border shadow-lg overflow-hidden z-50 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#e8e4dc]'}`}>
                  <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
                    <p className={`text-xs font-medium tracking-wide ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>Documents ({documents.length})</p>
                    <button
                      onClick={() => { createNewDocument(); setShowFileNav(false) }}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${isDark ? 'bg-white text-black' : 'bg-[#2d2a26] text-white'}`}
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
                        onClick={() => selectDocument(doc)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${doc.id === currentDocId ? (isDark ? 'text-white' : 'text-[#2d2a26]') : (isDark ? 'text-neutral-600' : 'text-[#9c958a]')}`}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                          <span className={`text-sm truncate ${doc.id === currentDocId ? (isDark ? 'text-white font-medium' : 'text-[#2d2a26] font-medium') : (isDark ? 'text-neutral-400' : 'text-[#5c574e]')}`}>
                            {doc.title}
                          </span>
                        </div>
                        {documents.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id) }}
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
                </div>
              )}
            </div>
          </div>

          {/* Right - Theme + User */}
          <div className="flex items-center gap-3">
            <button onClick={() => setIsDark(!isDark)} className="relative rounded-full transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden" style={{ width: 48, height: 24, backgroundColor: isDark ? '#262626' : '#e5e5e5' }} title="Toggle theme">
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
                className={`text-xs tracking-wide w-24 px-1.5 py-0.5 rounded-md border outline-none ${isDark ? 'bg-neutral-800 text-white border-neutral-600 focus:border-neutral-400' : 'bg-white text-[#2d2a26] border-[#d5d0c8] focus:border-[#9c958a]'}`}
                maxLength={30}
                autoFocus
              />
            ) : (
              <button onClick={startEditingName} className={`text-xs tracking-wide hover:underline cursor-pointer ${isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-[#9c958a] hover:text-[#5c574e]'}`} title="Click to edit name">
                {displayName || user.email?.split('@')[0]}
              </button>
            )}
            <button onClick={handleSignOut} className={`text-xs tracking-wide px-3 py-1.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#5c574e] hover:bg-[#f5f2ed]'}`}>Sign Out</button>
          </div>
        </div>
      </div>

      {/* Editor panels */}
      <div className="flex-1 overflow-hidden">
        <Group orientation="horizontal">
          <Panel defaultSize={50} minSize={25}>
            <DocumentEditor content={documentContent} onChange={handleContentChange} onUndo={undo} onRedo={redo} onSave={handleSave} isDark={isDark} />
          </Panel>
          <Separator className={`w-1 transition-colors duration-300 ${isDark ? 'bg-neutral-800 hover:bg-neutral-600' : 'bg-[#e8e4dc] hover:bg-[#ddd8ce]'}`} />
          <Panel defaultSize={50} minSize={25}>
            <AIChat documentContent={documentContent} onDocumentUpdate={handleAIUpdate} isDark={isDark} />
          </Panel>
        </Group>
      </div>
    </div>
  )
}
