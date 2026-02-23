'use client'

import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDark: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDark,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div
        className={`relative w-full max-w-sm mx-4 rounded-2xl border p-6 shadow-xl animate-scale-in ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#e8e4dc]'
        }`}
      >
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-[#2d2a26]'}`}>
          {title}
        </h3>
        <p className={`text-sm mb-6 ${isDark ? 'text-neutral-400' : 'text-[#5c574e]'}`}>
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className={`px-4 py-2 text-sm rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                : 'text-[#5c574e] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'
            }`}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
