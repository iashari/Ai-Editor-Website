'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
  functionCall?: { name: string; args: Record<string, unknown> }
}

interface Props {
  documentContent: string
  onDocumentUpdate: (newContent: string) => void
  isDark?: boolean
}

export default function AIChat({ documentContent, onDocumentUpdate, isDark = true }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ data: string; type: string; name: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isLoading])

  function showToast(message: string, type: 'error' | 'success' = 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { showToast('File must be less than 10MB', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => { setSelectedFile({ data: reader.result as string, type: file.type, name: file.name }) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function sendMessage() {
    if ((!input.trim() && !selectedFile) || isLoading) return
    setIsLoading(true)
    const userMessage: Message = { role: 'user', content: input.trim() || (selectedFile ? `[Attached: ${selectedFile.name}]` : '') }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          documentContent,
          file: selectedFile ? { data: selectedFile.data, type: selectedFile.type } : null,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.details || errorData?.error || 'Chat API failed')
      }
      const data = await response.json()
      if (data.newDocumentContent !== undefined) onDocumentUpdate(data.newDocumentContent)
      setMessages((prev) => [...prev, data.message])
      setSelectedFile(null)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errMsg}` }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function getToolLabel(name: string): string {
    const labels: Record<string, string> = {
      update_doc_by_line: 'Edit Lines',
      update_doc_by_replace: 'Find & Replace',
      insert_at_line: 'Insert',
      delete_lines: 'Delete',
      append_to_document: 'Append',
    }
    return labels[name] || name
  }

  return (
    <div className={`flex flex-col h-full relative ${isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-[#faf8f5] text-[#2d2a26]'}`}>
      {/* Toast popup */}
      {toast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border backdrop-blur-sm ${
            toast.type === 'error'
              ? isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
              : isDark ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-200 text-green-600'
          }`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {toast.type === 'error'
                ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
                : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
              }
            </svg>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#e8e4dc]'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium tracking-tight ${isDark ? 'text-neutral-200' : 'text-[#2d2a26]'}`}>AI Assistant</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'}`}>
            Online
          </span>
        </div>
        <button
          onClick={() => { setMessages([]); setSelectedFile(null) }}
          className={`text-xs px-3 py-1 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#5c574e] hover:bg-[#f5f2ed]'}`}
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className={`text-center py-16 ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>
            <div className={`w-10 h-10 mx-auto mb-4 rounded-xl border flex items-center justify-center ${isDark ? 'border-neutral-800 bg-neutral-900' : 'border-[#e8e4dc] bg-white'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isDark ? 'text-neutral-500' : 'text-[#9c958a]'}><path d="M12 8V4H8"/><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="4" y="8" width="16" height="12" rx="2"/><line x1="9" y1="13" x2="9" y2="13.01"/><line x1="15" y1="13" x2="15" y2="13.01"/><path d="M9 17h6"/></svg></div>
            <p className="text-sm font-medium mb-1 tracking-tight">AI Document Assistant</p>
            <p className="text-xs max-w-xs mx-auto leading-relaxed">
              Ask me to edit your document. I can update lines, find &amp; replace text, insert content, and more.
            </p>
            <div className="mt-6 space-y-2">
              {['"Ganti baris 1 jadi Hello World"', '"Add a title at the top"', '"Delete lines 3-5"'].map((tip, i) => (
                <p key={i} className={`text-xs ${isDark ? 'text-neutral-700' : 'text-[#ddd8ce]'}`}>{tip}</p>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? isDark
                  ? 'bg-white text-neutral-900 rounded-2xl rounded-br-md'
                  : 'bg-[#2d2a26] text-[#faf8f5] rounded-2xl rounded-br-md'
                : isDark
                  ? 'bg-neutral-900 text-neutral-100 rounded-2xl rounded-bl-md border border-neutral-800'
                  : 'bg-white text-[#2d2a26] rounded-2xl rounded-bl-md border border-[#e8e4dc]'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {msg.functionCall && (
                <div className={`mt-2 text-xs font-mono flex items-center gap-1.5 ${msg.role === 'user' ? 'opacity-70' : isDark ? 'text-green-400' : 'text-green-700'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  <span className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                    {getToolLabel(msg.functionCall.name)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className={`p-3.5 rounded-2xl rounded-bl-md text-sm ${isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-[#e8e4dc]'}`}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDark ? 'bg-neutral-400' : 'bg-[#9c958a]'}`} style={{ animationDelay: '0ms' }} />
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDark ? 'bg-neutral-400' : 'bg-[#9c958a]'}`} style={{ animationDelay: '150ms' }} />
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDark ? 'bg-neutral-400' : 'bg-[#9c958a]'}`} style={{ animationDelay: '300ms' }} />
                </div>
                <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Preview */}
      {selectedFile && (
        <div className={`px-4 py-2 border-t flex items-center justify-between ${isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-[#f5f2ed] border-[#e8e4dc] text-[#5c574e]'}`}>
          <div className="flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span className="truncate max-w-[200px]">{selectedFile.name}</span>
            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>({selectedFile.type || 'file'})</span>
          </div>
          <button onClick={() => setSelectedFile(null)} className={`px-1 transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-[#9c958a] hover:text-[#5c574e]'}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}

      {/* Input */}
      <div className={`p-3 border-t ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
        <div className="flex gap-2 mb-2">
          <label className={`px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 ${isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700' : 'bg-[#f5f2ed] text-[#5c574e] hover:bg-[#e8e4dc] border border-[#e8e4dc]'}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-px mr-1"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>Attach
            <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.txt,.md,.doc,.docx,.csv,.json,.xml,.html" />
          </label>
        </div>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            className={`flex-1 p-3 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 transition-colors ${isDark ? 'bg-neutral-900 text-neutral-100 border border-neutral-800 placeholder-neutral-600 focus:ring-neutral-600' : 'bg-white text-[#2d2a26] border border-[#e8e4dc] placeholder-[#9c958a] focus:ring-[#2d2a26]'}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Ask AI to edit the document..."
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !selectedFile)}
            className={`px-5 py-2 rounded-full text-sm font-bold tracking-wide transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 self-end ${isDark ? 'bg-white text-black' : 'bg-[#2d2a26] text-white'}`}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
