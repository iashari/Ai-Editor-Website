import { getSupabaseClient } from './supabaseClient'

export interface DocumentVersion {
  id: string
  document_id: string
  title: string
  content: string
  created_at: string
}

async function retry<T>(fn: () => Promise<T>, attempts = 2, delay = 1000): Promise<T> {
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === attempts) throw err
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('Retry failed')
}

export async function saveVersion(
  documentId: string,
  userId: string,
  title: string,
  content: string
): Promise<void> {
  if (!navigator.onLine) return

  await retry(async () => {
    const { error } = await getSupabaseClient()
      .from('document_versions')
      .insert({ document_id: documentId, user_id: userId, title, content })

    if (error) throw error
  })
}

export async function getVersions(documentId: string): Promise<DocumentVersion[]> {
  const { data, error } = await getSupabaseClient()
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}

export async function deleteVersion(versionId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('document_versions')
    .delete()
    .eq('id', versionId)

  if (error) throw error
}
