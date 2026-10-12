import type { Note } from './types'

export function getRelativeDate(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffH < 24) return `há ${diffH}h`
  if (diffD === 1) return 'ontem'
  if (diffD < 7) {
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
    return days[date.getDay()]
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Retorna todas as notas que linkam para a nota com o id dado */
export function getBacklinks(notes: Note[], noteId: string): Note[] {
  return notes.filter((n) => n.linkedNoteIds?.includes(noteId))
}

/** Retorna notas que mencionam o título sem wikilink formal */
export function getUnlinkedMentions(notes: Note[], noteId: string): Note[] {
  const note = notes.find((n) => n.id === noteId)
  if (!note?.title) return []
  const titleLower = note.title.toLowerCase()
  return notes.filter(
    (n) =>
      n.id !== noteId &&
      !n.linkedNoteIds?.includes(noteId) &&
      n.content.toLowerCase().includes(titleLower)
  )
}

/** Texto corrido sem marcação markdown, para prévias */
export function getPreview(content: string, max = 120): string {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^[-*]\s+(\[[ x]\]\s+)?/gm, '')
    .split('\n')
    .filter((l) => l.trim())
    .join(' ')
    .trim()
    .slice(0, max)
}

/** Extrai `- [ ] tarefa` / `- [x] tarefa` do markdown */
export function extractTasks(content: string): Note['tasks'] {
  const tasks = [...content.matchAll(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/gm)].map((m) => ({
    text: m[2].trim(),
    done: m[1] !== ' ',
  }))
  return tasks.length ? tasks : undefined
}

/** Resolve `[[Título]]` do conteúdo para ids de notas existentes */
export function extractLinkedIds(content: string, notes: Note[]): string[] | undefined {
  const titles = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim().toLowerCase())
  if (!titles.length) return undefined
  const ids = notes
    .filter((n) => n.title && titles.includes(n.title.toLowerCase()))
    .map((n) => n.id)
  return ids.length ? [...new Set(ids)] : undefined
}

const TASK_LINE = /^(\s*[-*]\s+\[)([ xX])(\]\s+.+)$/

/** Marca/desmarca a tarefa número `index` (na ordem do texto) e devolve o conteúdo novo */
export function toggleTaskAt(content: string, index: number): string {
  let k = -1
  return content
    .split('\n')
    .map((line) => {
      const m = line.match(TASK_LINE)
      if (!m || ++k !== index) return line
      return m[1] + (m[2] === ' ' ? 'x' : ' ') + m[3]
    })
    .join('\n')
}

/** Linha de tarefa markdown? Devolve feita/texto (aceita "-" ou "*", recuo e [X]) */
export function parseTaskLine(line: string): { done: boolean; text: string } | null {
  const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s?(.*)$/)
  return m ? { done: m[1] !== ' ', text: m[2] } : null
}
