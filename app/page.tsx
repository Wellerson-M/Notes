'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TimelineHeader from '@/components/TimelineHeader'
import ChipScroller, { Chip } from '@/components/ChipScroller'
import NoteCard from '@/components/NoteCard'
import BottomNav from '@/components/BottomNav'
import FAB from '@/components/FAB'
import type { Note } from '@/lib/types'
import { useNotes } from '@/lib/repo'
import { syncNow } from '@/lib/sync'
import { useUIStore } from '@/store/ui'
import EmptyState from '@/components/EmptyState'
import { isPast, sortValue } from '@/lib/schedule'

const FILTERS = ['Tudo', 'Hoje', 'Agendadas', 'Esta semana', 'Tarefas', 'Fixadas', 'Vault']

function filterNotes(notes: Note[], filter: string) {
  const now = new Date()
  switch (filter) {
    case 'Hoje':
      return notes.filter((n) => {
        const d = new Date(n.createdAt)
        return !n.inVault && d.toDateString() === now.toDateString()
      })
    case 'Esta semana':
      return notes.filter((n) => {
        const d = new Date(n.createdAt)
        return !n.inVault && (now.getTime() - d.getTime()) / 86400000 <= 7
      })
    case 'Agendadas':
      // O que ainda vai acontecer, do mais próximo para o mais distante
      return notes
        .filter((n) => !n.inVault && n.schedule && !isPast(n.schedule))
        .sort((a, b) => sortValue(a.schedule!).localeCompare(sortValue(b.schedule!)))
    case 'Tarefas':
      return notes.filter((n) => !n.inVault && (n.tasks?.length ?? 0) > 0)
    case 'Fixadas':
      return notes.filter((n) => !n.inVault && n.pinned)
    case 'Vault':
      return notes.filter((n) => n.inVault)
    default:
      return notes.filter((n) => !n.inVault)
  }
}

export default function TimelinePage() {
  const { activeFilter, setActiveFilter } = useUIStore()
  const [newNoteId, setNewNoteId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)

  const allNotes = useNotes()
  const notes = filterNotes(allNotes ?? [], activeFilter)
  const sortedNotes = activeFilter === 'Agendadas' ? notes : [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  useEffect(() => {
    const flag = sessionStorage.getItem('new-note-id')
    if (flag) {
      // sessionStorage só existe no cliente: lido depois da montagem para não divergir do SSR
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Pull-to-refresh: puxar a lista para baixo estando no topo dispara o sync
  const pullStart = useRef<number | null>(null)
  useEffect(() => {
    const onStart = (e: TouchEvent) => { pullStart.current = window.scrollY <= 0 ? e.touches[0].clientY : null }
    const onEnd = (e: TouchEvent) => {
      if (pullStart.current === null) return
      const dy = e.changedTouches[0].clientY - pullStart.current
      pullStart.current = null
      if (dy > 90) {
        setIsRefreshing(true)
        void syncNow().finally(() => setIsRefreshing(false))
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  return (
    <main style={{ minHeight: '100dvh', paddingBottom: 88 }}>
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
        {allNotes === undefined ? null : sortedNotes.length === 0 ? (
          <EmptyState
            icon={<span style={{ fontSize: 40, opacity: 0.3 }}>✍️</span>}
            message={activeFilter === 'Tudo' ? 'toque no + para a primeira nota...' : 'nada por aqui ainda...'}
          />
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
