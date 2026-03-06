'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createSnapshot } from '@/lib/versions'

const SNAPSHOT_INTERVAL = 30_000 // 30 seconds

/**
 * Auto-snapshot hook. Saves a version every 30s if content changed.
 * Deduplication is handled inside createSnapshot.
 * Returns saveNamedVersion for manual labeled saves.
 */
export function useAutoSnapshot(
  docId: string | null,
  userId: string | undefined,
  title: string,
  content: string
) {
  // Track latest values via refs (no interval restart on changes)
  const contentRef = useRef(content)
  const titleRef = useRef(title)
  const docIdRef = useRef(docId)
  const userIdRef = useRef(userId)

  useEffect(() => { contentRef.current = content }, [content])
  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { docIdRef.current = docId }, [docId])
  useEffect(() => { userIdRef.current = userId }, [userId])

  useEffect(() => {
    if (!docId || !userId) return

    const interval = setInterval(() => {
      const id = docIdRef.current
      const uid = userIdRef.current
      const c = contentRef.current
      if (!id || !uid || !c) return

      createSnapshot(id, c, uid).catch((err) => {
        console.error('Auto-snapshot failed:', err?.message || err)
      })
    }, SNAPSHOT_INTERVAL)

    return () => clearInterval(interval)
  }, [docId, userId])

  const saveNamedVersion = useCallback(
    async (label: string) => {
      const id = docIdRef.current
      const uid = userIdRef.current
      const c = contentRef.current
      if (!id || !uid) return null

      try {
        return await createSnapshot(id, c, uid, label)
      } catch (err) {
        console.error('saveNamedVersion failed:', err)
        return null
      }
    },
    []
  )

  return { saveNamedVersion }
}
