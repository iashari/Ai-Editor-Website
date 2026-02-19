'use client'

import { useEffect, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'

export function useAutoSave(documentId: string | null, content: string) {
  const savedContentRef = useRef(content)
  const timeoutRef = useRef<NodeJS.Timeout>(undefined)

  useEffect(() => {
    if (!documentId) return
    if (content === savedContentRef.current) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      await getSupabaseClient()
        .from('documents')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', documentId)

      savedContentRef.current = content
    }, 2000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [documentId, content])
}
