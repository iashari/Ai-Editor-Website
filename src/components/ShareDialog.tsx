'use client'

import { useState, useEffect } from 'react'
import { createShareLink, getSharesForDocument, revokeShare, type ShareLink } from '@/lib/sharing'
import { motion, AnimatePresence } from './animations/MotionDiv'

interface DocumentItem {
  id: string
  title: string
}

interface ShareDialogProps {
  open: boolean
  documentId: string
  ownerId: string
  isDark: boolean
  onClose: () => void
  documents?: DocumentItem[]
}

export default function ShareDialog({ open, documentId, ownerId, isDark, onClose, documents }: ShareDialogProps) {
  const [selectedDocId, setSelectedDocId] = useState(documentId)
  const [shares, setShares] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [expiry, setExpiry] = useState<string>('none')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Sync selected doc when dialog opens or current doc changes
  useEffect(() => {
    if (open) setSelectedDocId(documentId)
  }, [open, documentId])

  useEffect(() => {
    if (open && selectedDocId) {
      loadShares()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedDocId])

  async function loadShares() {
    setLoading(true)
    try {
      const data = await getSharesForDocument(selectedDocId)
      setShares(data)
    } catch (err) {
      if (err instanceof Error) console.error('Failed to load shares:', err.message)
    }
    setLoading(false)
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const expiryHours = expiry === '1h' ? 1 : expiry === '24h' ? 24 : expiry === '7d' ? 168 : undefined
      const share = await createShareLink(selectedDocId, ownerId, permission, expiryHours)
      setShares((prev) => [share, ...prev])
      copyToClipboard(share)
    } catch (err) {
      if (err instanceof Error) console.error('Failed to create share link:', err.message)
    }
    setCreating(false)
  }

  async function handleRevoke(shareId: string) {
    try {
      await revokeShare(shareId)
      setShares((prev) => prev.filter((s) => s.id !== shareId))
    } catch (err) {
      if (err instanceof Error) console.error('Failed to revoke share:', err.message)
    }
  }

  function copyToClipboard(share: ShareLink) {
    const url = `${window.location.origin}/shared/${share.share_token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(share.id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {
      // Fallback
    })
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function isExpired(share: ShareLink) {
    if (!share.expires_at) return false
    return new Date(share.expires_at) < new Date()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`relative w-full max-w-md mx-4 rounded-2xl border shadow-xl overflow-hidden ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-[#faf8f5] border-[#d5d0c8]'}`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-[#2d2a26]'}`}>Share Document</h3>
              <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Document selector */}
            {documents && documents.length > 1 && (
              <div className={`px-6 py-3 border-b ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-neutral-400' : 'text-[#5c574e]'}`}>
                  Share which document?
                </label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className={`w-full text-sm px-3 py-2 rounded-lg border outline-none transition-colors ${isDark ? 'bg-neutral-800 text-white border-neutral-700 focus:border-neutral-500' : 'bg-[#f5f2ed] text-[#2d2a26] border-[#d5d0c8] focus:border-[#9c958a]'}`}
                >
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Create new share */}
            <div className={`px-6 py-4 border-b ${isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-neutral-400' : 'text-[#5c574e]'}`}>Permission</label>
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                    className={`w-full text-sm px-3 py-2 rounded-lg border outline-none ${isDark ? 'bg-neutral-800 text-white border-neutral-700' : 'bg-[#f5f2ed] text-[#2d2a26] border-[#d5d0c8]'}`}
                  >
                    <option value="view">View only</option>
                    <option value="edit">Can edit</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-neutral-400' : 'text-[#5c574e]'}`}>Expires</label>
                  <select
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className={`w-full text-sm px-3 py-2 rounded-lg border outline-none ${isDark ? 'bg-neutral-800 text-white border-neutral-700' : 'bg-[#f5f2ed] text-[#2d2a26] border-[#d5d0c8]'}`}
                  >
                    <option value="none">Never</option>
                    <option value="1h">1 hour</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: isDark ? '#ffffff' : '#2d2a26', color: isDark ? '#000000' : '#ffffff' }}
              >
                {creating ? 'Creating...' : 'Create Share Link'}
              </button>
            </div>

            {/* Active shares */}
            <div className="px-6 py-4 max-h-64 overflow-y-auto">
              <p className={`text-xs font-medium tracking-wide uppercase mb-3 ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
                Active Links ({shares.filter((s) => !isExpired(s)).length})
              </p>

              {loading ? (
                <div className="flex justify-center py-4">
                  <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isDark ? 'border-neutral-700 border-t-white' : 'border-[#e8e4dc] border-t-[#2d2a26]'}`} />
                </div>
              ) : shares.length === 0 ? (
                <p className={`text-sm text-center py-4 ${isDark ? 'text-neutral-600' : 'text-[#9c958a]'}`}>
                  No share links yet
                </p>
              ) : (
                <div className="space-y-2">
                  {shares.map((share, i) => (
                    <motion.div
                      key={share.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        isExpired(share)
                          ? isDark ? 'border-neutral-800 opacity-50' : 'border-[#e8e4dc] opacity-50'
                          : isDark ? 'border-neutral-800' : 'border-[#e8e4dc]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            share.permission === 'edit'
                              ? isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'
                              : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-[#f5f2ed] text-[#5c574e]'
                          }`}>
                            {share.permission === 'edit' ? 'Edit' : 'View'}
                          </span>
                          {isExpired(share) && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700'}`}>
                              Expired
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
                          Created {formatDate(share.created_at)}
                          {share.expires_at && ` · Expires ${formatDate(share.expires_at)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        {!isExpired(share) && (
                          <button
                            onClick={() => copyToClipboard(share)}
                            className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-[#9c958a] hover:text-[#2d2a26] hover:bg-[#f5f2ed]'}`}
                            title="Copy link"
                          >
                            {copiedId === share.id ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleRevoke(share.id)}
                          className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${isDark ? 'text-neutral-600 hover:text-red-400 hover:bg-neutral-800' : 'text-[#9c958a] hover:text-red-500 hover:bg-red-50'}`}
                          title="Revoke"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
