'use client'

import { useRef, useCallback, useEffect } from 'react'

export function useThrottle<T extends unknown[]>(
  fn: (...args: T) => void,
  limitMs: number
): (...args: T) => void {
  const lastRun = useRef<number>(0)
  const fnRef = useRef(fn)
  const trailingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    return () => {
      if (trailingRef.current) clearTimeout(trailingRef.current)
    }
  }, [])

  return useCallback((...args: T) => {
    const now = Date.now()
    if (trailingRef.current) clearTimeout(trailingRef.current)

    if (now - lastRun.current >= limitMs) {
      lastRun.current = now
      fnRef.current(...args)
    } else {
      // Always fire the last call (trailing)
      trailingRef.current = setTimeout(() => {
        lastRun.current = Date.now()
        fnRef.current(...args)
        trailingRef.current = null
      }, limitMs - (now - lastRun.current))
    }
  }, [limitMs])
}
