import { getSupabaseClient } from './supabaseClient'

export interface VersionSummary {
  id: string
  document_id: string
  version_number: number
  title: string
  label: string | null
  created_at: string
  created_by: string | null
}

export interface VersionFull extends VersionSummary {
  content: string
}

/**
 * Create a snapshot of a document. Deduplicates by comparing content
 * with the latest version — skips insert if content is identical.
 * Returns the version id if inserted, or null if deduplicated.
 */
export async function createSnapshot(
  docId: string,
  content: string,
  userId: string,
  label?: string
): Promise<string | null> {
  if (!navigator.onLine) return null

  try {
    const supabase = getSupabaseClient()

    // Fetch the latest version's content + number for dedup check
    const { data: latest } = await supabase
      .from('document_versions')
      .select('content, version_number')
      .eq('document_id', docId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Skip if content identical to latest version (unless labeled)
    if (latest && latest.content === content && !label) {
      return null
    }

    const nextVersion = (latest?.version_number ?? 0) + 1

    // Fetch current document title
    const { data: doc } = await supabase
      .from('documents')
      .select('title')
      .eq('id', docId)
      .single()

    const { data, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: docId,
        user_id: userId,
        created_by: userId,
        title: doc?.title ?? 'Untitled',
        content,
        version_number: nextVersion,
        label: label ?? null,
      })
      .select('id')
      .single()

    if (error) throw error
    return data?.id ?? null
  } catch (err) {
    console.error('createSnapshot error:', err)
    throw err
  }
}

/**
 * Get paginated version list WITHOUT content (saves bandwidth).
 */
export async function getVersionList(
  docId: string,
  page = 0,
  pageSize = 20
): Promise<{ versions: VersionSummary[]; hasMore: boolean }> {
  const from = page * pageSize
  const to = from + pageSize

  const { data, error } = await getSupabaseClient()
    .from('document_versions')
    .select('id, document_id, version_number, title, label, created_at, created_by')
    .eq('document_id', docId)
    .order('version_number', { ascending: false })
    .range(from, to)

  if (error) throw new Error('Failed to load version history')

  const versions = (data ?? []) as VersionSummary[]
  const hasMore = versions.length > pageSize
  return {
    versions: hasMore ? versions.slice(0, pageSize) : versions,
    hasMore,
  }
}

/**
 * Fetch a single version WITH full content (for diff/restore).
 */
export async function getVersionContent(versionId: string): Promise<VersionFull> {
  const { data, error } = await getSupabaseClient()
    .from('document_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (error) throw new Error('Version not found')
  return data as VersionFull
}

/**
 * Restore a version: update the document and create a new snapshot
 * labeled "Restored from vX".
 */
export async function restoreVersion(
  docId: string,
  versionId: string,
  userId: string
): Promise<{ content: string; title: string }> {
  try {
    const version = await getVersionContent(versionId)

    // Update the document with the restored content
    const { error } = await getSupabaseClient()
      .from('documents')
      .update({
        content: version.content,
        title: version.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId)

    if (error) throw new Error('Failed to restore document')

    // Create a new snapshot labeled "Restored from vX"
    await createSnapshot(
      docId,
      version.content,
      userId,
      `Restored from v${version.version_number}`
    )

    return { content: version.content, title: version.title }
  } catch (err) {
    console.error('restoreVersion error:', err)
    throw err
  }
}
