'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface CollaboratorPresence {
  userId: string
  displayName: string
  color: string
  cursor: { line: number; col: number } | null
  mouse: { x: number; y: number } | null
  lastSeen: string
}

const COLLABORATOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#FF8A5C', '#A29BFE', '#FD79A8', '#00CEC9',
]

function getColorForIndex(index: number): string {
  return COLLABORATOR_COLORS[index % COLLABORATOR_COLORS.length]
}

interface PresencePayload {
  userId: string
  displayName: string
  color: string
  lastSeen: string
}

interface UseCollaborationOptions {
  documentId: string | null
  userId: string
  displayName: string
  onContentChange?: (newContent: string, fromUserId: string) => void
}

export function useCollaboration({
  documentId,
  userId,
  displayName,
  onContentChange,
}: UseCollaborationOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [myColor, setMyColor] = useState(COLLABORATOR_COLORS[0])
  const myColorRef = useRef(COLLABORATOR_COLORS[0])
  const onContentChangeRef = useRef(onContentChange)
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const cursorMapRef = useRef<Record<string, { line: number; col: number }>>({})
  const mouseMapRef = useRef<Record<string, { x: number; y: number }>>({})

  useEffect(() => {
    onContentChangeRef.current = onContentChange
  }, [onContentChange])

  const broadcastContentChange = useCallback((newContent: string) => {
    if (!channelRef.current || !isConnected) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'content_change',
      payload: { content: newContent, userId, timestamp: Date.now() },
    })
  }, [userId, isConnected])

  const updateCursor = useCallback((line: number, col: number) => {
    if (!channelRef.current || !isConnected) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor_move',
      payload: { userId, line, col },
    })
  }, [userId, isConnected])

  // Broadcast mouse pointer position (pixel coords relative to page container)
  const updateMouse = useCallback((x: number, y: number) => {
    if (!channelRef.current || !isConnected) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'mouse_move',
      payload: { userId, x, y },
    })
  }, [userId, isConnected])

  useEffect(() => {
    if (!documentId || !userId) return

    const supabase = getSupabaseClient()
    const channel = supabase.channel(`collab:${documentId}`, {
      config: {
        presence: { key: userId },
        broadcast: { self: false },
      },
    })

    // Presence sync — track who's online
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload>()
      const allUsers = Object.values(state).map((entries) => entries[0])
      const others = allUsers.filter((u) => u.userId !== userId)

      const allSorted = [...allUsers].sort(
        (a, b) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime()
      )
      const myIndex = allSorted.findIndex((u) => u.userId === userId)
      if (myIndex >= 0) {
        const newColor = getColorForIndex(myIndex)
        myColorRef.current = newColor
        setMyColor(newColor)
      }

      setCollaborators(others.map((u) => {
        const idx = allSorted.findIndex((s) => s.userId === u.userId)
        return {
          userId: u.userId,
          displayName: u.displayName,
          color: getColorForIndex(idx >= 0 ? idx : 0),
          cursor: cursorMapRef.current[u.userId] || null,
          mouse: mouseMapRef.current[u.userId] || null,
          lastSeen: u.lastSeen,
        }
      }))
    })

    // Broadcast — receive text cursor moves
    channel.on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
      if (payload.userId === userId) return
      cursorMapRef.current[payload.userId] = { line: payload.line, col: payload.col }
      setCollaborators((prev) =>
        prev.map((c) =>
          c.userId === payload.userId
            ? { ...c, cursor: { line: payload.line, col: payload.col } }
            : c
        )
      )
    })

    // Broadcast — receive mouse pointer moves
    channel.on('broadcast', { event: 'mouse_move' }, ({ payload }) => {
      if (payload.userId === userId) return
      mouseMapRef.current[payload.userId] = { x: payload.x, y: payload.y }
      setCollaborators((prev) =>
        prev.map((c) =>
          c.userId === payload.userId
            ? { ...c, mouse: { x: payload.x, y: payload.y } }
            : c
        )
      )
    })

    // Broadcast — receive content changes
    channel.on('broadcast', { event: 'content_change' }, ({ payload }) => {
      if (payload.userId === userId) return

      setTypingUsers((prev) =>
        prev.includes(payload.userId) ? prev : [...prev, payload.userId]
      )
      clearTimeout(typingTimersRef.current[payload.userId])
      typingTimersRef.current[payload.userId] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== payload.userId))
      }, 2000)

      if (onContentChangeRef.current) {
        onContentChangeRef.current(payload.content, payload.userId)
      }
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        await channel.track({
          userId,
          displayName,
          color: myColorRef.current,
          lastSeen: new Date().toISOString(),
        })
      }
    })

    channelRef.current = channel

    return () => {
      Object.values(typingTimersRef.current).forEach(clearTimeout)
      typingTimersRef.current = {}
      cursorMapRef.current = {}
      mouseMapRef.current = {}

      supabase.removeChannel(channel)
      channelRef.current = null
      setIsConnected(false)
      setCollaborators([])
      setTypingUsers([])
    }
  }, [documentId, userId, displayName])

  return {
    collaborators,
    typingUsers,
    isConnected,
    myColor,
    broadcastContentChange,
    updateCursor,
    updateMouse,
  }
}
