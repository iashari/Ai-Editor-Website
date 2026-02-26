'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type ChatMessage,
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
} from '@/lib/chatStorage'

export function useChatPersistence(documentId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>(undefined)
  const docIdRef = useRef(documentId)

  // Track current documentId to avoid stale saves
  useEffect(() => {
    docIdRef.current = documentId
  }, [documentId])

  // Load on mount / doc change
  useEffect(() => {
    if (!documentId || !userId) return

    let cancelled = false
    loadChatMessages(documentId)
      .then((dbMessages) => {
        if (cancelled || docIdRef.current !== documentId) return
        setMessages(dbMessages)
      })
      .catch((err) => {
        console.error('Failed to load chat messages:', err?.message || err)
      })
      .finally(() => {
        if (!cancelled && docIdRef.current === documentId) setIsLoading(false)
      })

    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [documentId, userId])

  // Debounced save to Supabase when messages change
  const saveToSupabase = useCallback(
    (msgs: ChatMessage[]) => {
      if (!documentId || !userId) return

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        if (docIdRef.current !== documentId) return
        saveChatMessages(documentId, userId, msgs).catch((err) => {
          console.error('Failed to save chat messages:', err?.message || err)
        })
      }, 2000)
    },
    [documentId, userId]
  )

  const updateMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setMessages((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        saveToSupabase(next)
        return next
      })
    },
    [saveToSupabase]
  )

  const clearAll = useCallback(() => {
    if (!documentId) return
    setMessages([])
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    clearChatMessages(documentId).catch((err) => {
      console.error('Failed to clear chat messages:', err?.message || err)
    })
  }, [documentId])

  return { messages, setMessages: updateMessages, clearMessages: clearAll, isLoading }
}
