import { getSupabaseClient } from './supabaseClient'

export interface DocumentTag {
  id: string
  document_id: string
  user_id: string
  tag: string
}

export type SortOption = 'updated_desc' | 'updated_asc' | 'title_asc' | 'title_desc' | 'created_desc'

const SORT_CONFIG: Record<SortOption, { column: string; ascending: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  updated_asc: { column: 'updated_at', ascending: true },
  title_asc: { column: 'title', ascending: true },
  title_desc: { column: 'title', ascending: false },
  created_desc: { column: 'created_at', ascending: false },
}

const PAGE_SIZE = 20

export async function fetchDocuments(options: {
  search?: string
  sort?: SortOption
  page?: number
}) {
  const { search, sort = 'updated_desc', page = 0 } = options
  const { column, ascending } = SORT_CONFIG[sort]
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = getSupabaseClient()
    .from('documents')
    .select('id, title, content, created_at, updated_at', { count: 'exact' })
    .order(column, { ascending })
    .range(from, to)

  if (search && search.trim()) {
    query = query.ilike('title', `%${search.trim()}%`)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: data ?? [], total: count ?? 0, hasMore: (count ?? 0) > to + 1 }
}

export async function addTag(documentId: string, userId: string, tag: string): Promise<DocumentTag | null> {
  const trimmed = tag.trim().toLowerCase()
  if (!trimmed) return null

  const { data, error } = await getSupabaseClient()
    .from('document_tags')
    .insert({ document_id: documentId, user_id: userId, tag: trimmed })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return null // duplicate tag
    throw error
  }
  return data
}

export async function removeTag(tagId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('document_tags')
    .delete()
    .eq('id', tagId)

  if (error) throw error
}

export async function getTagsForDocuments(documentIds: string[]): Promise<Record<string, DocumentTag[]>> {
  if (documentIds.length === 0) return {}

  const { data, error } = await getSupabaseClient()
    .from('document_tags')
    .select('*')
    .in('document_id', documentIds)

  if (error) throw error

  const result: Record<string, DocumentTag[]> = {}
  for (const tag of data ?? []) {
    if (!result[tag.document_id]) result[tag.document_id] = []
    result[tag.document_id].push(tag)
  }
  return result
}

export async function getAllUserTags(userId: string): Promise<string[]> {
  const { data, error } = await getSupabaseClient()
    .from('document_tags')
    .select('tag')
    .eq('user_id', userId)

  if (error) throw error

  const unique = [...new Set((data ?? []).map((t) => t.tag))]
  return unique.sort()
}

export async function getDocumentIdsByTag(tag: string): Promise<string[]> {
  const { data, error } = await getSupabaseClient()
    .from('document_tags')
    .select('document_id')
    .eq('tag', tag)

  if (error) throw error
  return (data ?? []).map((t) => t.document_id)
}
