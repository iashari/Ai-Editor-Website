'use client'

import { useState, useRef, useEffect } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchDocuments, renameDocument, addTag, removeTag, getTagsForDocuments, getAllUserTags, getDocumentIdsByTag, type SortOption, type DocumentTag } from '@/lib/documents'
import ConfirmDialog from './ConfirmDialog'
import { motion, AnimatePresence } from './animations/MotionDiv'
import AnimatedItem from './animations/AnimatedItem'

interface Document {
  id: string
  title: string
  content: string
}

interface DocumentSidebarProps {
  documents: Document[]
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>
  currentDocId: string | null
  onSelectDocument: (doc: Document) => void
  onCreateDocument: () => void
  onDeleteDocument: (docId: string) => void
  isDark: boolean
  userId: string
}

const SORT_LABELS: Record<SortOption, string> = {
  updated_desc: 'Last Modified',
  updated_asc: 'Oldest',
  title_asc: 'Title A-Z',
  title_desc: 'Title Z-A',
  created_desc: 'Newest Created',
}

const TAG_COLORS = [
  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'bg-green-500/15 text-green-400 border-green-500/30',
  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'bg-pink-500/15 text-pink-400 border-pink-500/30',
  'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
]

const TAG_COLORS_LIGHT = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-yellow-50 text-yellow-700 border-yellow-200',
]

function getTagColor(tag: string, isDark: boolean): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % TAG_COLORS.length
  return isDark ? TAG_COLORS[index] : TAG_COLORS_LIGHT[index]
}

export default function DocumentSidebar({
  documents,
  setDocuments,
  currentDocId,
  onSelectDocument,
  onCreateDocument,
  onDeleteDocument,
  isDark,
  userId,
}: DocumentSidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Sort
  const [sortBy, setSortBy] = useState<SortOption>('updated_desc')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  // Pagination
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  // Tags
  const [docTags, setDocTags] = useState<Record<string, DocumentTag[]>>({})
  const [allTags, setAllTags] = useState<string[]>([])
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [addingTagDocId, setAddingTagDocId] = useState<string | null>(null)
  const [newTagValue, setNewTagValue] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select()
  }, [renamingId])

  useEffect(() => {
    if (addingTagDocId) tagInputRef.current?.focus()
  }, [addingTagDocId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handler wrappers that also reset page
  function handleSearchChange(value: string) {
    setSearchQuery(value)
    setPage(0)
  }

  function handleSortChange(value: SortOption) {
    setSortBy(value)
    setPage(0)
    setShowSortMenu(false)
  }

  function handleFilterTagChange(tag: string | null) {
    setFilterTag(tag)
    setPage(0)
  }

  // Load documents when search/sort/page/filterTag changes
  useEffect(() => {
    let cancelled = false
    async function loadDocs() {
      setLoading(true)
      try {
        let filteredDocIds: string[] | null = null
        if (filterTag) {
          filteredDocIds = await getDocumentIdsByTag(filterTag)
        }

        const result = await fetchDocuments({ userId, search: debouncedSearch, sort: sortBy, page })
        if (cancelled) return

        let docs = result.data
        if (filteredDocIds !== null) {
          docs = docs.filter((d) => filteredDocIds.includes(d.id))
        }

        if (page === 0) {
          setDocuments(docs)
        } else {
          setDocuments((prev) => {
            const existingIds = new Set(prev.map((d) => d.id))
            const newDocs = docs.filter((d) => !existingIds.has(d.id))
            return [...prev, ...newDocs]
          })
        }
        setHasMore(result.hasMore)
      } catch (err) {
        if (err instanceof Error) console.error('Failed to load documents:', err.message)
      }
      if (!cancelled) setLoading(false)
    }

    loadDocs()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortBy, page, filterTag])

  // Load tags when documents change
  useEffect(() => {
    const ids = documents.map((d) => d.id)
    if (ids.length === 0) return
    getTagsForDocuments(ids)
      .then(setDocTags)
      .catch((err) => {
        if (err instanceof Error) console.error('Failed to load tags:', err.message)
      })
  }, [documents])

  // Load all user tags for filter chips
  useEffect(() => {
    if (!userId) return
    getAllUserTags(userId)
      .then(setAllTags)
      .catch((err) => {
        if (err instanceof Error) console.error('Failed to load all tags:', err.message)
      })
  }, [userId, docTags])

  function startRename(doc: Document) {
    setRenamingId(doc.id)
    setRenameValue(doc.title)
  }

  async function commitRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    const doc = documents.find((d) => d.id === renamingId)
    if (!trimmed || trimmed === doc?.title) {
      setRenamingId(null)
      return
    }
    try {
      await renameDocument(renamingId, trimmed)
      setDocuments((prev) =>
        prev.map((d) => (d.id === renamingId ? { ...d, title: trimmed } : d))
      )
    } catch (err) {
      if (err instanceof Error) console.error('Rename failed:', err.message)
    }
    setRenamingId(null)
  }

  function handleDeleteClick(e: React.MouseEvent, doc: Document) {
    e.stopPropagation()
    setDeleteTarget(doc)
  }

  function confirmDelete() {
    if (deleteTarget) {
      onDeleteDocument(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  async function handleAddTag(docId: string) {
    const trimmed = newTagValue.trim().toLowerCase()
    if (!trimmed) {
      setAddingTagDocId(null)
      setNewTagValue('')
      return
    }
    try {
      const tag = await addTag(docId, userId, trimmed)
      if (tag) {
        setDocTags((prev) => ({
          ...prev,
          [docId]: [...(prev[docId] || []), tag],
        }))
      }
    } catch (err) {
      if (err instanceof Error) console.error('Failed to add tag:', err.message)
    }
    setNewTagValue('')
    setAddingTagDocId(null)
  }

  async function handleRemoveTag(tagRecord: DocumentTag) {
    try {
      await removeTag(tagRecord.id)
      setDocTags((prev) => ({
        ...prev,
        [tagRecord.document_id]: (prev[tagRecord.document_id] || []).filter((t) => t.id !== tagRecord.id),
      }))
    } catch (err) {
      if (err instanceof Error) console.error('Failed to remove tag:', err.message)
    }
  }

  return (
    <>
      <div className={`h-full flex flex-col border-r ${isDark ? 'bg-neutral-950/50 border-neutral-800' : 'bg-[#faf8f5]/50 border-[#e8e4dc]'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
          <h2 className={`text-xs font-semibold tracking-widest uppercase ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
            Documents
          </h2>
          <button
            onClick={onCreateDocument}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ backgroundColor: isDark ? '#ffffff' : '#2d2a26', color: isDark ? '#000000' : '#ffffff' }}
            title="New Document"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>

        {/* Search */}
        <div className={`px-3 py-2 border-b ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
          <div className="relative">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`absolute top-1/2 -translate-y-1/2 ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}
              style={{ left: '10px' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search documents..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
                isDark
                  ? 'bg-neutral-900 text-white border-neutral-800 placeholder-neutral-600 focus:border-neutral-600'
                  : 'bg-[#f5f2ed] text-[#2d2a26] border-[#d5d0c8] placeholder-[#9c958a] focus:border-[#9c958a]'
              }`}
            />
          </div>

          {/* Sort + Filter row */}
          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors w-full ${
                  isDark
                    ? 'text-neutral-400 border-neutral-800 hover:border-neutral-600 bg-neutral-900'
                    : 'text-[#5c574e] border-[#d5d0c8] hover:border-[#9c958a] bg-[#f5f2ed]'
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="14" y2="12" />
                  <line x1="4" y1="18" x2="8" y2="18" />
                </svg>
                <span className="truncate">{SORT_LABELS[sortBy]}</span>
              </button>
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className={`absolute top-full mt-1 left-0 w-full rounded-lg border shadow-lg overflow-hidden z-50 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-[#f5f2ed] border-[#d5d0c8]'}`}
                  >
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => handleSortChange(key)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          sortBy === key
                            ? isDark ? 'bg-neutral-800 text-white' : 'bg-[#f0ede8] text-[#2d2a26]'
                            : isDark ? 'text-neutral-400 hover:bg-neutral-800' : 'text-[#5c574e] hover:bg-[#f5f2ed]'
                        }`}
                      >
                        {SORT_LABELS[key]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className={`px-3 py-2 flex flex-wrap gap-1 border-b ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
            {filterTag && (
              <button
                onClick={() => handleFilterTagChange(null)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${isDark ? 'text-neutral-400 border-neutral-700 hover:bg-neutral-800' : 'text-[#5c574e] border-[#d5d0c8] hover:bg-[#f5f2ed]'}`}
              >
                All
              </button>
            )}
            {allTags.map((tag) => (
              <motion.button
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                onClick={() => handleFilterTagChange(filterTag === tag ? null : tag)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  filterTag === tag
                    ? getTagColor(tag, isDark)
                    : isDark ? 'text-neutral-500 border-neutral-700 hover:border-neutral-600' : 'text-[#9c958a] border-[#e8e4dc] hover:border-[#d5d0c8]'
                }`}
              >
                {tag}
              </motion.button>
            ))}
          </div>
        )}

        {/* Document list */}
        <div className="flex-1 overflow-y-auto">
          {loading && documents.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isDark ? 'border-neutral-700 border-t-white' : 'border-[#e8e4dc] border-t-[#2d2a26]'}`} />
            </div>
          ) : documents.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full px-4 text-center ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
              {debouncedSearch ? (
                <>
                  <p className="text-sm font-medium mb-1">No results</p>
                  <p className="text-xs">No documents matching &quot;{debouncedSearch}&quot;</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium mb-1">No documents</p>
                  <p className="text-xs">Click &quot;New&quot; to create your first document</p>
                </>
              )}
            </div>
          ) : (
            <>
              {documents.map((doc, index) => (
                <AnimatedItem key={doc.id} index={index} direction="up">
                  <div
                    className={`group px-4 py-2.5 cursor-pointer transition-all duration-200 active:scale-[0.98] ${
                      doc.id === currentDocId
                        ? isDark ? 'bg-neutral-800/60' : 'bg-[#f0ede8]'
                        : isDark ? 'hover:bg-neutral-800/30' : 'hover:bg-[#f5f2ed]'
                    }`}
                    onClick={() => {
                      if (renamingId !== doc.id) onSelectDocument(doc)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`shrink-0 ${
                          doc.id === currentDocId
                            ? isDark ? 'text-white' : 'text-[#2d2a26]'
                            : isDark ? 'text-neutral-600' : 'text-[#9c958a]'
                        }`}
                      >
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                        <polyline points="13 2 13 9 20 9" />
                      </svg>

                      {renamingId === doc.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          onBlur={commitRename}
                          className={`flex-1 text-sm px-1.5 py-0.5 rounded-md border outline-none min-w-0 ${
                            isDark
                              ? 'bg-neutral-800 text-white border-neutral-600 focus:border-neutral-400'
                              : 'bg-[#f5f2ed] text-[#2d2a26] border-[#d5d0c8] focus:border-[#9c958a]'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`flex-1 text-sm truncate ${
                            doc.id === currentDocId
                              ? isDark ? 'text-white font-medium' : 'text-[#2d2a26] font-medium'
                              : isDark ? 'text-neutral-400' : 'text-[#5c574e]'
                          }`}
                          onDoubleClick={() => startRename(doc)}
                        >
                          {doc.title}
                        </span>
                      )}

                      {/* Actions (visible on hover) */}
                      {renamingId !== doc.id && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(doc) }}
                            className={`p-1 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 ${isDark ? 'text-neutral-600 hover:text-neutral-300 hover:bg-neutral-700' : 'text-[#9c958a] hover:text-[#5c574e] hover:bg-[#f0ede8]'}`}
                            title="Rename"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setAddingTagDocId(addingTagDocId === doc.id ? null : doc.id) }}
                            className={`p-1 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 ${isDark ? 'text-neutral-600 hover:text-neutral-300 hover:bg-neutral-700' : 'text-[#9c958a] hover:text-[#5c574e] hover:bg-[#f0ede8]'}`}
                            title="Add tag"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                              <line x1="7" y1="7" x2="7.01" y2="7" />
                            </svg>
                          </button>
                          {documents.length > 1 && (
                            <button
                              onClick={(e) => handleDeleteClick(e, doc)}
                              className={`p-1 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 ${isDark ? 'text-neutral-600 hover:text-red-400 hover:bg-neutral-700' : 'text-[#9c958a] hover:text-red-500 hover:bg-red-50'}`}
                              title="Delete"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tags for this doc */}
                    {((docTags[doc.id] && docTags[doc.id].length > 0) || addingTagDocId === doc.id) && (
                      <div className="mt-1.5 ml-6 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        {(docTags[doc.id] || []).map((tagRecord) => (
                          <motion.span
                            key={tagRecord.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border cursor-default ${getTagColor(tagRecord.tag, isDark)}`}
                          >
                            {tagRecord.tag}
                            <button
                              onClick={() => handleRemoveTag(tagRecord)}
                              className="hover:opacity-70 ml-0.5"
                              title="Remove tag"
                            >
                              ×
                            </button>
                          </motion.span>
                        ))}
                        {addingTagDocId === doc.id && (
                          <input
                            ref={tagInputRef}
                            value={newTagValue}
                            onChange={(e) => setNewTagValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddTag(doc.id)
                              if (e.key === 'Escape') { setAddingTagDocId(null); setNewTagValue('') }
                            }}
                            onBlur={() => handleAddTag(doc.id)}
                            placeholder="tag..."
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border outline-none w-16 ${
                              isDark
                                ? 'bg-neutral-800 text-white border-neutral-600 focus:border-neutral-400'
                                : 'bg-[#f5f2ed] text-[#2d2a26] border-[#d5d0c8] focus:border-[#9c958a]'
                            }`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </AnimatedItem>
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="px-4 py-3">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loading}
                    className={`w-full text-xs py-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'text-neutral-400 border-neutral-800 hover:bg-neutral-800 disabled:opacity-50'
                        : 'text-[#5c574e] border-[#e8e4dc] hover:bg-[#f5f2ed] disabled:opacity-50'
                    }`}
                  >
                    {loading ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        isDark={isDark}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
