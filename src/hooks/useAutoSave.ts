'use client'

import { useEffect, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'

type SaveStatus = 'saving' | 'saved' | 'error'

export function useAutoSave(
  documentId: string | null,
  content: string,
  onSaveStatusChange?: (status: SaveStatus) => void
) {
  const savedContentRef = useRef(content)
  const timeoutRef = useRef<NodeJS.Timeout>(undefined)
  const callbackRef = useRef(onSaveStatusChange)

  useEffect(() => {
    callbackRef.current = onSaveStatusChange
  }, [onSaveStatusChange])

  useEffect(() => {
    if (!documentId) return
    if (content === savedContentRef.current) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      if (!navigator.onLine) return

      try {
        callbackRef.current?.('saving')
        const { error } = await getSupabaseClient()
          .from('documents')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', documentId)

        if (error) {
          callbackRef.current?.('error')
          return
        }

        savedContentRef.current = content
        callbackRef.current?.('saved')
      } catch {
        callbackRef.current?.('error')
      }
    }, 2000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [documentId, content])
}
