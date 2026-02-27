'use client'

import { motion, AnimatePresence } from './animations/MotionDiv'
import type { CollaboratorPresence } from '@/hooks/useCollaboration'

interface PresenceIndicatorProps {
  collaborators: CollaboratorPresence[]
  typingUsers: string[]
  isConnected: boolean
  isDark: boolean
}

export default function PresenceIndicator({
  collaborators,
  typingUsers,
  isConnected,
  isDark,
}: PresenceIndicatorProps) {
  if (!isConnected && collaborators.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      {/* Connection status dot */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isConnected ? 'bg-green-500' : 'bg-neutral-500'
            }`}
          />
        </span>
        <span className={`text-xs ${isConnected ? 'text-green-400' : isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}>
          Live
        </span>
      </div>

      {/* Separator */}
      {collaborators.length > 0 && (
        <div className={`w-px h-4 ${isDark ? 'bg-neutral-700' : 'bg-[#e8e4dc]'}`} />
      )}

      {/* Collaborator avatars */}
      <div className="flex items-center -space-x-2">
        <AnimatePresence>
          {collaborators.map((collab) => {
            const isTyping = typingUsers.includes(collab.userId)
            const initials = collab.displayName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()

            return (
              <motion.div
                key={collab.userId}
                initial={{ scale: 0, opacity: 0, x: -8 }}
                animate={{ scale: 1, opacity: 1, x: 0 }}
                exit={{ scale: 0, opacity: 0, x: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative group"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
                  style={{
                    backgroundColor: collab.color + '25',
                    borderColor: isDark ? 'rgba(10,10,10,0.9)' : 'rgba(250,248,245,0.9)',
                    color: collab.color,
                    boxShadow: isTyping ? `0 0 0 2px ${isDark ? '#0a0a0a' : '#faf8f5'}, 0 0 0 4px ${collab.color}` : 'none',
                    transition: 'box-shadow 0.4s ease',
                  }}
                >
                  {initials || '?'}
                  <AnimatePresence>
                    {isTyping && (
                      <motion.div
                        className="absolute -bottom-0.5 -right-0.5 flex gap-[2px]"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.25 }}
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="w-[3px] h-[3px] rounded-full"
                            style={{ backgroundColor: collab.color }}
                            animate={{ y: [0, -3, 0] }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              delay: i * 0.15,
                            }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tooltip */}
                <div
                  className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg backdrop-blur-md ${
                    isDark
                      ? 'bg-neutral-800/90 text-neutral-200 border border-neutral-700'
                      : 'bg-white/90 text-[#2d2a26] border border-[#e8e4dc]'
                  }`}
                >
                  {collab.displayName}
                  {isTyping && (
                    <span className={`ml-1 ${isDark ? 'text-neutral-400' : 'text-[#9c958a]'}`}>
                      typing...
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Online count badge */}
      {collaborators.length > 0 && (
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
            isDark
              ? 'bg-neutral-800 text-neutral-400'
              : 'bg-[#f5f2ed] text-[#9c958a]'
          }`}
        >
          {collaborators.length + 1} online
        </span>
      )}

      {/* Typing text indicator */}
      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.2 }}
            className={`text-[11px] ${isDark ? 'text-neutral-500' : 'text-[#9c958a]'}`}
          >
            {typingUsers
              .map((uid) => collaborators.find((c) => c.userId === uid)?.displayName ?? 'Someone')
              .join(', ')}{' '}
            sedang mengetik...
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
