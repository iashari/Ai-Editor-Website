'use client'

import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'

export function useRealtimeDocument(
  documentId: string | null,
  onUpdate: (content: string) => void
) {
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
          onUpdate(payload.new.content)
        }
      )
      .subscribe()

    return () => {
      getSupabaseClient().removeChannel(channel)
    }
  }, [documentId, onUpdate])
}
