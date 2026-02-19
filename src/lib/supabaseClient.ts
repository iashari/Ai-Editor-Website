'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _sb: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (_sb) return _sb
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
  _sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } })
  return _sb
}
