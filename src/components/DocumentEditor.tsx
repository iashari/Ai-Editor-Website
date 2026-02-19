'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Props {
  content: string
  onChange: (content: string) => void
  onUndo?: () => void
  onRedo?: () => void
  onSave?: () => void
  isDark?: boolean
}

export default function DocumentEditor({ content, onChange, onUndo, onRedo, onSave, isDark = true }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const lineCount = (content || '').split('\n').length

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); onSave?.() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); onUndo?.() }
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) { e.preventDefault(); onRedo?.() }
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = textareaRef.current
        if (!textarea) return
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        onChange(content.substring(0, start) + '  ' + content.substring(end))
        requestAnimationFrame(() => { textarea.selectionStart = textarea.selectionEnd = start + 2 })
      }
    },
    [content, onChange, onUndo, onRedo, onSave]
  )

  useEffect(() => { textareaRef.current?.focus() }, [])

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-[#faf8f5]'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#e8e4dc]'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium tracking-tight ${isDark ? 'text-neutral-200' : 'text-[#2d2a26]'}`}>Editor</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-neutral-800 text-neutral-500' : 'bg-[#f5f2ed] text-[#9c958a]'}`}>
            {lineCount} lines
          </span>
        </div>
        <div className={`flex items-center gap-2 text-xs font-mono ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>
          <kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-neutral-800 text-neutral-500' : 'bg-[#f5f2ed] text-[#9c958a]'}`}>Ctrl+S</kbd>
          <kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-neutral-800 text-neutral-500' : 'bg-[#f5f2ed] text-[#9c958a]'}`}>Ctrl+Z</kbd>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={lineNumbersRef}
          className={`w-12 text-right pr-3 py-3 font-mono text-xs select-none overflow-hidden shrink-0 ${isDark ? 'bg-neutral-900 text-neutral-600 border-r border-neutral-800' : 'bg-[#f5f2ed] text-[#9c958a] border-r border-[#e8e4dc]'}`}
          style={{ lineHeight: '1.5rem' }}
        >
          {Array.from({ length: lineCount }, (_, i) => (<div key={i + 1}>{i + 1}</div>))}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          className={`flex-1 p-3 font-mono text-sm resize-none focus:outline-none ${isDark ? 'bg-neutral-950 text-neutral-100 caret-white' : 'bg-[#faf8f5] text-[#2d2a26] caret-[#2d2a26]'}`}
          style={{ lineHeight: '1.5rem' }}
          placeholder="Start typing your document here..."
          spellCheck={false}
        />
      </div>
    </div>
  )
}
