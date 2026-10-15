'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sparkles, Plus, CalendarClock } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import HeatmapCalendar from '@/components/HeatmapCalendar'
import BottomSheet from '@/components/BottomSheet'
import EmptyState from '@/components/EmptyState'
import { AIThinking, AIError as AIErrorMessage } from '@/components/AISheets'
import { renderMarkdown } from '@/components/MarkdownEditor'
import type { Note } from '@/lib/types'
import { getPreview } from '@/lib/notes'
import { ListenButton } from '@/components/ListenBar'
import { notesRepo, useNotes } from '@/lib/repo'
import { ai, AIError } from '@/lib/ai'
import { noteHref } from '@/lib/routes'
import { addDays, dateKey, dayLabel, isPast, parseKey, sortValue, todayKey } from '@/lib/schedule'

const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type Review = { loading: boolean; text?: string; error?: string; period: string }
type Scheduled = Note & { schedule: NonNullable<Note['schedule']> }

const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
const openTasks = (n: Note) => n.tasks?.filter((t) => !t.done).length ?? 0

function NoteRow({ note, showTime = true }: { note: Note; showTime?: boolean }) {
  const time = note.schedule?.time
  const pending = openTasks(note)
  return (
    <Link href={noteHref(note.id)}>
      <div
        className="touch-feedback noise-card flex items-start gap-3 px-4 py-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--card-radius, 14px)' }}
      >
        {showTime && (
          <span
            className="font-sans flex-shrink-0 text-center"
            style={{
              fontSize: 12, fontWeight: 600, minWidth: 44, paddingTop: 1,
              color: time ? 'var(--accent-amber)' : 'var(--text-muted)',
            }}
          >
            {time ?? 'dia'}
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="font-sans font-medium line-clamp-1" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
            {note.title || getPreview(note.content, 60) || 'sem título'}
          </div>
          {note.title && getPreview(note.content) && (
            <div className="font-serif line-clamp-1" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {getPreview(note.content, 90)}
            </div>
          )}
        </div>
        {pending > 0 && (
          <span className="font-sans flex-shrink-0" style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 2 }}>
            {pending} aberta{pending > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  )
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-2 mt-1">
      <h2 className="font-serif font-medium" style={{ fontSize: 17, color: 'var(--text-primary)' }}>{children}</h2>
      {aside}
    </div>
  )
}

export default function AgendaPage() {
  const router = useRouter()
  const [review, setReview] = useState<Review | null>(null)
  const [today] = useState(() => new Date())
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | undefined>(today.getDate())

  // O Vault não aparece na agenda
  const all = useNotes()
  const notes = useMemo(() => (all ?? []).filter((n) => !n.inVault), [all])

  const scheduled = useMemo(
    () => notes.filter((n): n is Scheduled => !!n.schedule).sort((a, b) => sortValue(a.schedule).localeCompare(sortValue(b.schedule))),
    [notes],
  )

  // Próximos 60 dias, agrupados por dia; e o que passou na última semana com tarefa aberta
  const { upcoming, overdue } = useMemo(() => {
    const limit = dateKey(addDays(new Date(), 60))
    const weekAgo = dateKey(addDays(new Date(), -7))
    const groups = new Map<string, Scheduled[]>()
    const late: Scheduled[] = []
    for (const n of scheduled) {
      if (!isPast(n.schedule)) {
        if (n.schedule.date > limit) continue
        groups.set(n.schedule.date, [...(groups.get(n.schedule.date) ?? []), n])
      } else if (n.schedule.date >= weekAgo && openTasks(n) > 0) {
        late.push(n)
      }
    }
    return { upcoming: [...groups.entries()], overdue: late }
  }, [scheduled])

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const scheduledDays = useMemo(
    () => new Set(scheduled.filter((n) => n.schedule.date.startsWith(monthKey)).map((n) => Number(n.schedule.date.slice(8)))),
    [scheduled, monthKey],
  )

  const selectedKey = selectedDay ? `${monthKey}-${String(selectedDay).padStart(2, '0')}` : null
  const onSelected = selectedKey ? scheduled.filter((n) => n.schedule.date === selectedKey) : []
  const writtenSelected = selectedKey ? notes.filter((n) => dateKey(new Date(n.createdAt)) === selectedKey) : []

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

  const changeMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelectedDay(undefined)
  }

  const newFor = (key: string) => router.push(`/note?mode=text&date=${key}`)

  return (
    <main style={{ minHeight: '100dvh', paddingBottom: 88 }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 pt-safe flex items-center justify-between"
        style={{ height: 56, background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)', paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
      >
        <span className="font-title font-semibold" style={{ fontSize: 18, color: 'var(--text-primary)' }}>Agenda</span>
        <button
          onClick={() => newFor(selectedKey ?? todayKey())}
          className="touch-feedback flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans"
          style={{ background: 'var(--accent-amber-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent-amber)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={14} /> Agendar
        </button>
      </div>

      <div className="flex flex-col gap-6 px-4 py-4">
        {/* Próximos */}
        <section>
          <SectionTitle aside={<span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>próximos 60 dias</span>}>
            Próximos
          </SectionTitle>
          {upcoming.length === 0 ? (
            <div
              className="flex items-center gap-3 px-4 py-4 font-sans"
              style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-default)', borderRadius: 'var(--card-radius, 14px)', fontSize: 13, color: 'var(--text-muted)', lineHeight: '19px' }}
            >
              <CalendarClock size={20} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
              Nada agendado. Numa nota, toque em “agendar”, ou peça ao assistente: “anota dentista sexta às 9h”.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {upcoming.map(([key, items]) => (
                <div key={key}>
                  <div className="font-sans font-semibold uppercase mb-1.5" style={{ fontSize: 11, letterSpacing: '0.08em', color: key === todayKey() ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                    {dayLabel(key)}{/\d/.test(dayLabel(key)) ? '' : ` · ${fmt(parseKey(key))}`}
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((n) => <NoteRow key={n.id} note={n} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ficou para trás */}
        {overdue.length > 0 && (
          <section>
            <SectionTitle>Ficou para trás</SectionTitle>
            <div className="flex flex-col gap-2">
              {overdue.map((n) => (
                <div key={n.id} style={{ opacity: 0.85 }}>
                  <div className="font-sans mb-1" style={{ fontSize: 11, color: 'var(--danger)' }}>{dayLabel(n.schedule.date)}</div>
                  <NoteRow note={n} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Resumo da semana */}
        <button
          onClick={runReview}
          className="touch-feedback flex items-center justify-center gap-2 w-full py-3 font-sans"
          style={{ background: 'var(--accent-amber-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--card-radius, 14px)', color: 'var(--accent-amber)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Sparkles size={15} /> Resumo da semana
        </button>

        {/* Calendário */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="touch-feedback p-2" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <ChevronLeft size={18} />
            </button>
            <span className="font-sans font-semibold" style={{ fontSize: 15, color: 'var(--text-primary)' }}>{MONTH_FULL[month]} {year}</span>
            <button onClick={() => changeMonth(1)} aria-label="Próximo mês" className="touch-feedback p-2" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <ChevronRight size={18} />
            </button>
          </div>
          <HeatmapCalendar
            notes={notes}
            year={year}
            month={month}
            selectedDay={selectedDay}
            scheduledDays={scheduledDays}
            onSelectDay={(d) => setSelectedDay(d === selectedDay ? undefined : d)}
          />
          <p className="font-sans mt-2 px-1" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            cor = notas escritas no dia · <span style={{ color: 'var(--accent-gold)' }}>●</span> = algo na agenda
          </p>
        </section>

        {/* Dia escolhido */}
        {selectedKey && (
          <section>
            <SectionTitle
              aside={
                <button onClick={() => newFor(selectedKey)} className="flex items-center gap-1 font-sans" style={{ fontSize: 12, color: 'var(--accent-amber)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Plus size={13} /> nota para este dia
                </button>
              }
            >
              {parseKey(selectedKey).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </SectionTitle>
            {onSelected.length === 0 && writtenSelected.length === 0 ? (
              <EmptyState message="nada neste dia" paddingTop={24} fieldHeight={120} />
            ) : (
              <div className="flex flex-col gap-2">
                {onSelected.map((n) => <NoteRow key={n.id} note={n} />)}
                {writtenSelected.length > 0 && (
                  <>
                    <div className="font-sans font-semibold uppercase mt-2" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>escritas neste dia</div>
                    {writtenSelected.map((n) => <NoteRow key={n.id} note={n} showTime={false} />)}
                  </>
                )}
              </div>
            )}
          </section>
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
                <div className="px-5 pt-4 pb-2 font-serif" style={{ fontSize: 15, lineHeight: '26px', color: 'var(--text-secondary)' }}>
                  {renderMarkdown(review.text ?? '')}
                </div>
                <div className="px-5 pb-3">
                  <ListenButton text={review.text ?? ''} title={`Semana · ${review.period}`} id={`review-${review.period}`} />
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
                    style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--accent-amber)', color: 'var(--on-accent)', border: 'none' }}
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
