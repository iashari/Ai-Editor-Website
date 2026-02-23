import { getSupabaseClient } from './supabaseClient'

export interface ShareLink {
  id: string
  document_id: string
  owner_id: string
  share_token: string
  permission: 'view' | 'edit'
  expires_at: string | null
  created_at: string
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  for (const byte of array) {
    token += chars[byte % chars.length]
  }
  return token
}

export async function createShareLink(
  documentId: string,
  ownerId: string,
  permission: 'view' | 'edit',
  expiresInHours?: number
): Promise<ShareLink> {
  const shareToken = generateToken()
  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
    : null

  const { data, error } = await getSupabaseClient()
    .from('document_shares')
    .insert({
      document_id: documentId,
      owner_id: ownerId,
      share_token: shareToken,
      permission,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSharesForDocument(documentId: string): Promise<ShareLink[]> {
  const { data, error } = await getSupabaseClient()
    .from('document_shares')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function revokeShare(shareId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('document_shares')
    .delete()
    .eq('id', shareId)

  if (error) throw error
}
