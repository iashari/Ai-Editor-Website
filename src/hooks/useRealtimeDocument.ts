'use client'

import { useEffect, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'

export function useRealtimeDocument(
  documentId: string | null,
  onUpdate: (content: string) => void
) {
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    if (!documentId) return

    const channel = getSupabaseClient()
      .channel(`document:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`,
        },
        (payload: { new: { content: string } }) => {
          onUpdateRef.current(payload.new.content)
        }
      )
      .subscribe()

    return () => {
      getSupabaseClient().removeChannel(channel)
    }
  }, [documentId])
}
