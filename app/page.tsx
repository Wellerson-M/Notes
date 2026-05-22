'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TimelineHeader from '@/components/TimelineHeader'
import ChipScroller, { Chip } from '@/components/ChipScroller'
import NoteCard from '@/components/NoteCard'
import BottomNav from '@/components/BottomNav'
import FAB from '@/components/FAB'
import { mockNotes } from '@/mocks/notes'
import { useUIStore } from '@/store/ui'

const FILTERS = ['Tudo', 'Hoje', 'Esta semana', 'Com áudio', 'Com foto', 'Tarefas', 'Fixadas', 'Vault']

function filterNotes(notes: typeof mockNotes, filter: string) {
  const now = new Date('2026-05-21T12:00:00')
  switch (filter) {
    case 'Hoje':
      return notes.filter((n) => {
        const d = new Date(n.createdAt)
        return d.toDateString() === now.toDateString()
      })
    case 'Esta semana':
      return notes.filter((n) => {
        const d = new Date(n.createdAt)
        return (now.getTime() - d.getTime()) / 86400000 <= 7
      })
    case 'Com áudio':
      return notes.filter((n) => !!n.attachments.audio)
    case 'Com foto':
      return notes.filter((n) => (n.attachments.photos?.length ?? 0) > 0)
    case 'Tarefas':
      return notes.filter((n) => (n.tasks?.length ?? 0) > 0)
    case 'Fixadas':
      return notes.filter((n) => n.pinned)
    case 'Vault':
      return notes.filter((n) => n.inVault)
    default:
      return notes
  }
}

export default function TimelinePage() {
  const { activeFilter, setActiveFilter } = useUIStore()
  const [newNoteId, setNewNoteId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)

  const notes = filterNotes(mockNotes, activeFilter)
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  useEffect(() => {
    const flag = sessionStorage.getItem('new-note-id')
    if (flag) {
      setNewNoteId(flag)
      sessionStorage.removeItem('new-note-id')
      setTimeout(() => setNewNoteId(null), 1000)
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      setHeaderVisible(y < lastScrollY.current || y < 80)
      lastScrollY.current = y
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    useUIStore.getState().setSyncStatus('syncing')
    setTimeout(() => {
      setIsRefreshing(false)
      useUIStore.getState().setSyncStatus('ok')
    }, 1500)
  }

  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100dvh', paddingBottom: 88 }}>
      <motion.div
        animate={{ y: headerVisible ? 0 : -120, opacity: headerVisible ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <TimelineHeader />
      </motion.div>

      {/* Pull-to-refresh */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid var(--accent-amber)',
                borderTopColor: 'transparent',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter chips */}
      <div className="px-4 py-3">
        <ChipScroller>
          {FILTERS.map((f) => (
            <Chip key={f} label={f} active={activeFilter === f} onClick={() => setActiveFilter(f)} />
          ))}
        </ChipScroller>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-3 px-4">
        {sortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80 }}>
            <span style={{ fontSize: 40, opacity: 0.3 }}>✍️</span>
            <p className="font-serif italic" style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: 12 }}>
              nada por aqui ainda...
            </p>
          </div>
        ) : (
          sortedNotes.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.03 }}
            >
              <NoteCard note={note} showInkWave={note.id === newNoteId} />
            </motion.div>
          ))
        )}
      </div>

      <FAB />
      <BottomNav />
    </main>
  )
}
