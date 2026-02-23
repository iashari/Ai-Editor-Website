'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import DocumentEditor from '@/components/DocumentEditor'
import AIChat from '@/components/AIChat'
import AuthScreen from '@/components/AuthScreen'
import EditorNavbar from '@/components/EditorNavbar'
import DocumentSidebar from '@/components/DocumentSidebar'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useRealtimeDocument } from '@/hooks/useRealtimeDocument'

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

export interface Document {
  id: string
  title: string
  content: string
}

export default function EditorPage() {
  const { user, loading: authLoading } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [currentDocId, setCurrentDocId] = useState<string | null>(null)
  const [docTitle, setDocTitle] = useState('Untitled Document')
  const [isDark, setIsDark] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved')
  const [displayName, setDisplayName] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const { current: documentContent, push: pushHistory, undo, redo, canUndo, canRedo } = useHistory('')

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
    }
  }, [user])

  // Auto-select first document when documents load and none is selected
  useEffect(() => {
    if (documents.length > 0 && !currentDocId) {
      setCurrentDocId(documents[0].id)
      setDocTitle(documents[0].title)
      pushHistory(documents[0].content)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, currentDocId])

  async function createNewDocument() {
    if (!user) return
    try {
      const { data, error } = await getSupabaseClient().from('documents').insert({ user_id: user.id, title: 'Untitled Document', content: '' }).select().single()
      if (data && !error) {
        setDocuments((prev) => [data, ...prev])
        setCurrentDocId(data.id)
        setDocTitle(data.title)
        pushHistory(data.content)
      }
    } catch (err) {
      if (err instanceof Error) console.error('createNewDocument failed:', err.message)
    }
  }

  function selectDocument(doc: Document) {
    setCurrentDocId(doc.id)
    setDocTitle(doc.title)
    pushHistory(doc.content)
  }

  async function deleteDocument(docId: string) {
    if (documents.length <= 1) return
    try {
      const { error } = await getSupabaseClient().from('documents').delete().eq('id', docId)
      if (error) {
        console.error('Failed to delete document:', error.message)
        return
      }
      const remaining = documents.filter((d) => d.id !== docId)
      setDocuments(remaining)
      if (currentDocId === docId && remaining.length > 0) {
        selectDocument(remaining[0])
      }
    } catch (err) {
      if (err instanceof Error) console.error('deleteDocument failed:', err.message)
    }
  }

  useAutoSave(currentDocId, documentContent, (status) => setSaveStatus(status))
  useRealtimeDocument(currentDocId, (content) => pushHistory(content))

  const handleContentChange = useCallback((newContent: string) => {
    pushHistory(newContent)
    setSaveStatus('unsaved')
  }, [pushHistory])

  const handleAIUpdate = useCallback(async (newContent: string) => {
    pushHistory(newContent)
    if (currentDocId) {
      try {
        setSaveStatus('saving')
        const { error } = await getSupabaseClient().from('documents').update({ content: newContent, updated_at: new Date().toISOString() }).eq('id', currentDocId)
        setSaveStatus(error ? 'error' : 'saved')
      } catch (err) {
        if (err instanceof Error) console.error('AI update save failed:', err.message)
        setSaveStatus('error')
      }
    }
  }, [pushHistory, currentDocId])

  const handleSave = useCallback(async () => {
    if (!currentDocId) return
    try {
      setSaveStatus('saving')
      const { error } = await getSupabaseClient().from('documents').update({ content: documentContent, title: docTitle, updated_at: new Date().toISOString() }).eq('id', currentDocId)
      setSaveStatus(error ? 'error' : 'saved')
    } catch (err) {
      if (err instanceof Error) console.error('Manual save failed:', err.message)
      setSaveStatus('error')
    }
  }, [currentDocId, documentContent, docTitle])

  function exportAs(format: 'txt' | 'md' | 'html' | 'doc' | 'pdf') {
    const title = docTitle || 'document'
    const content = documentContent || ''

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

  async function handleSignOut() {
    try {
      await getSupabaseClient().auth.signOut()
    } catch (err) {
      if (err instanceof Error) console.error('Sign out failed:', err.message)
    }
    setDocuments([])
    setCurrentDocId(null)
    pushHistory('')
  }

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
    return <AuthScreen />
  }

  // Main editor
  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-[#faf8f5]'}`}>
      <EditorNavbar
        docTitle={docTitle}
        setDocTitle={setDocTitle}
        currentDocId={currentDocId}
        saveStatus={saveStatus}
        setSaveStatus={setSaveStatus}
        isDark={isDark}
        setIsDark={setIsDark}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        documents={documents}
        setDocuments={setDocuments}
        onCreateDocument={createNewDocument}
        onSelectDocument={selectDocument}
        onDeleteDocument={deleteDocument}
        onExport={exportAs}
        onSignOut={handleSignOut}
        displayName={displayName}
        userEmail={user.email || ''}
        userId={user.id}
        onSidebarToggle={() => setShowSidebar(!showSidebar)}
        showSidebar={showSidebar}
      />

      {/* Main content: Sidebar + Editor + AI Chat */}
      <div className="flex-1 overflow-hidden flex">
        {/* Collapsible sidebar */}
        {showSidebar && (
          <div className="w-64 shrink-0">
            <DocumentSidebar
              documents={documents}
              setDocuments={setDocuments}
              currentDocId={currentDocId}
              onSelectDocument={selectDocument}
              onCreateDocument={createNewDocument}
              onDeleteDocument={deleteDocument}
              isDark={isDark}
              userId={user.id}
            />
          </div>
        )}

        {/* Editor + AI Chat panels */}
        <div className="flex-1 overflow-hidden">
          <Group orientation="horizontal">
            <Panel defaultSize={50} minSize={25}>
              <DocumentEditor key={`editor-${currentDocId}`} content={documentContent} onChange={handleContentChange} onUndo={undo} onRedo={redo} onSave={handleSave} isDark={isDark} />
            </Panel>
            <Separator className={`w-1 transition-colors duration-300 ${isDark ? 'bg-neutral-800 hover:bg-neutral-600' : 'bg-[#e8e4dc] hover:bg-[#ddd8ce]'}`} />
            <Panel defaultSize={50} minSize={25}>
              <AIChat key={`chat-${currentDocId}`} documentContent={documentContent} onDocumentUpdate={handleAIUpdate} isDark={isDark} />
            </Panel>
          </Group>
        </div>
      </div>
    </div>
  )
}
