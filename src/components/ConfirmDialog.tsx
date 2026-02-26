'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from './animations/MotionDiv'

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
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`relative w-full max-w-xs mx-4 rounded-xl border p-4 shadow-xl ${
              isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#e8e4dc]'
            }`}
          >
            <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-[#2d2a26]'}`}>
              {title}
            </h3>
            <p className={`text-xs mb-3 ${isDark ? 'text-neutral-400' : 'text-[#5c574e]'}`}>
              {message}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
                  isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    : 'text-[#5c574e] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'
                }`}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
