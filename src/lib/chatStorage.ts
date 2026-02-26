import { getSupabaseClient } from './supabaseClient'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  functionCall?: { name: string; args: Record<string, unknown> }
}

// ── Supabase ──

export async function loadChatMessages(documentId: string): Promise<ChatMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from('chat_messages')
    .select('role, content, function_call')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    role: row.role as ChatMessage['role'],
    content: row.content,
    ...(row.function_call ? { functionCall: row.function_call } : {}),
  }))
}

export async function saveChatMessages(
  documentId: string,
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
  const supabase = getSupabaseClient()

  // Delete existing then insert all (simple, avoids complex diff)
  const { error: delError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('document_id', documentId)

  if (delError) throw delError

  if (messages.length === 0) return

  const rows = messages.map((msg) => ({
    document_id: documentId,
    user_id: userId,
    role: msg.role,
    content: msg.content,
    function_call: msg.functionCall ?? null,
  }))

  const { error: insError } = await supabase.from('chat_messages').insert(rows)
  if (insError) throw insError
}

export async function clearChatMessages(documentId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('chat_messages')
    .delete()
    .eq('document_id', documentId)

  if (error) throw error
}

