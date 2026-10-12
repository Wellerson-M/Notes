'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import HeatmapCalendar from '@/components/HeatmapCalendar'
import type { Note } from '@/lib/types'
import { getPreview } from '@/lib/notes'
import { notesRepo, useNotes } from '@/lib/repo'
import { ai, AIError } from '@/lib/ai'
import BottomSheet from '@/components/BottomSheet'
import { AIThinking, AIError as AIErrorMessage } from '@/components/AISheets'
import { renderMarkdown } from '@/components/MarkdownEditor'
import Link from 'next/link'
import EmptyState from '@/components/EmptyState'
import { noteHref } from '@/lib/routes'

const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEK_DAYS_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function groupByDay(notes: Note[], year: number, month: number) {
  const grouped: Record<number, Note[]> = {}
  notes.forEach((n) => {
    const d = new Date(n.createdAt)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!grouped[day]) grouped[day] = []
      grouped[day].push(n)
    }
  })
  return grouped
}

type Review = { loading: boolean; text?: string; error?: string; period: string }

const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

export default function JournalPage() {
  const router = useRouter()
  const [review, setReview] = useState<Review | null>(null)
  const [today] = useState(() => new Date())
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | undefined>(today.getDate())

  // O cofre não aparece no diário
  const notes = (useNotes() ?? []).filter((n) => !n.inVault)
  const grouped = groupByDay(notes, year, month)
  const daysWithNotes = Object.keys(grouped).map(Number).sort((a, b) => b - a)

  /** Retrospectiva dos últimos 7 dias pela IA */
  const runReview = async () => {
    const to = new Date()
    const from = new Date(to.getTime() - 7 * 86400000)
    const period = `${fmt(from)} a ${fmt(to)}`
    setReview({ loading: true, period })
    try {
      const { text, count } = await ai.review(notes, from, to, period)
      setReview(count ? { loading: false, text, period } : { loading: false, error: 'Nenhuma nota nos últimos 7 dias.', period })
    } catch (e) {
      setReview({ loading: false, error: e instanceof AIError ? e.message : 'A IA não conseguiu responder agora.', period })
    }
  }

  const saveReview = async () => {
    if (!review?.text) return
    const note = await notesRepo.create({ title: `Semana de ${review.period}`, content: review.text, tags: ['retrospectiva'] })
    setReview(null)
    router.push(noteHref(note.id))
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(undefined)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(undefined)
  }

  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100dvh', paddingBottom: 88 }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 pt-safe flex items-center justify-between"
        style={{
          height: 56,
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
        }}
      >
        <button
          onClick={prevMonth}
          className="touch-feedback p-2 rounded-lg"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-sans font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)' }}>
          {MONTH_FULL[month]}. {year}
        </span>
        <button
          onClick={nextMonth}
          className="touch-feedback p-2 rounded-lg"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Retrospectiva */}
      <div className="px-4 pt-4">
        <button
          onClick={runReview}
          className="touch-feedback flex items-center justify-center gap-2 w-full rounded-xl py-3 font-sans"
          style={{ background: 'var(--accent-amber-soft)', border: '1px solid rgba(232,165,71,0.3)', color: 'var(--accent-amber)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Sparkles size={15} /> Resumo da semana
        </button>
      </div>

      {/* Heatmap */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <HeatmapCalendar
          notes={notes}
          year={year}
          month={month}
          selectedDay={selectedDay}
          onSelectDay={(d) => setSelectedDay(d === selectedDay ? undefined : d)}
        />
      </div>

      {/* Day groups */}
      <div className="flex flex-col gap-6 px-4 py-4">
        {daysWithNotes.length === 0 ? (
          <EmptyState message="nenhuma nota neste mês" paddingTop={60} fieldHeight={200} />
        ) : (
          (selectedDay && grouped[selectedDay] ? [selectedDay] : daysWithNotes).map((day) => {
            const dayNotes = grouped[day] ?? []
            const date = new Date(year, month, day)
            const weekDay = WEEK_DAYS_FULL[date.getDay()]
            const dayStr = `${weekDay}, ${day} de ${MONTH_FULL[month].toLowerCase()}`

            return (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="font-serif font-medium" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
                    {dayStr}
                  </h2>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    ({dayNotes.length} {dayNotes.length === 1 ? 'nota' : 'notas'})
                  </span>
                </div>

                {/* Compact note list */}
                <div className="flex flex-col gap-2">
                  {dayNotes.map((note) => {
                    const time = new Date(note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    const preview = getPreview(note.content, 80)

                    return (
                      <Link href={noteHref(note.id)} key={note.id}>
                        <div
                          className="touch-feedback noise-card rounded-xl px-4 py-3"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div style={{ minWidth: 0, flex: 1 }}>
                              {note.title && (
                                <div className="font-sans font-medium line-clamp-1" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                  {note.title}
                                </div>
                              )}
                              <div className="font-serif line-clamp-1" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: note.title ? 2 : 0 }}>
                                {preview}
                              </div>
                            </div>
                            <span className="font-sans flex-shrink-0" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{time}</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      <AnimatePresence>
        {review && (
          <BottomSheet title={`Semana · ${review.period}`} onClose={() => setReview(null)}>
            {review.loading ? (
              <AIThinking action="review" />
            ) : review.error ? (
              <AIErrorMessage message={review.error} />
            ) : (
              <>
                <div className="px-5 py-4 font-serif" style={{ fontSize: 15, lineHeight: '26px', color: 'var(--text-secondary)' }}>
                  {renderMarkdown(review.text ?? '')}
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    onClick={() => setReview(null)}
                    className="touch-feedback flex-1 rounded-xl py-3 font-sans"
                    style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                  >
                    Fechar
                  </button>
                  <button
                    onClick={saveReview}
                    className="touch-feedback flex-1 rounded-xl py-3 font-sans"
                    style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--accent-amber)', color: '#111210', border: 'none' }}
                  >
                    Salvar como nota
                  </button>
                </div>
              </>
            )}
          </BottomSheet>
        )}
      </AnimatePresence>

      <BottomNav />
    </main>
  )
}
