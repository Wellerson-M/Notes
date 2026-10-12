import { isAuthenticated, unauthorized } from '@/lib/auth'
import { notesCollection, type NoteDoc } from '@/lib/mongo'
import type { Note } from '@/lib/types'

type SyncBody = { since?: number; notes?: Note[] }

const MAX_NOTES_PER_PUSH = 500

/**
 * Recebe as notas alteradas no aparelho e devolve o que mudou no servidor desde `since`.
 * Conflito: vence a versão com `updatedAt` mais recente.
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized()

  const body = (await request.json().catch(() => null)) as SyncBody | null
  if (!body || !Array.isArray(body.notes ?? [])) {
    return Response.json({ error: 'corpo inválido' }, { status: 400 })
  }
  const incoming = (body.notes ?? []).slice(0, MAX_NOTES_PER_PUSH).filter(isNote)
  const since = typeof body.since === 'number' ? body.since : 0

  const col = await notesCollection()
  const startedAt = Date.now()

  if (incoming.length) {
    await col.bulkWrite(
      incoming.map(({ id, ...rest }) => ({
        updateOne: {
          // Só grava se o servidor não tiver uma versão mais nova
          filter: { _id: id, updatedAt: { $lt: rest.updatedAt } },
          update: { $set: { ...rest, syncedAt: Date.now() } },
          upsert: true,
        },
      })),
      { ordered: false },
    ).catch((err: { code?: number; writeErrors?: unknown[] }) => {
      // E11000 = a nota já existe com versão mais nova (o filtro não casou e o upsert colidiu) — esperado
      const errors = (err.writeErrors ?? []) as { code?: number }[]
      if (err.code !== 11000 && !errors.every((e) => e.code === 11000)) throw err
    })
  }

  // Sobreposição de 5s no cursor cobre gravações concorrentes; reaplicar uma nota é inofensivo
  const changed = await col.find({ syncedAt: { $gte: since } }).toArray()
  const notes: Note[] = changed.map(({ _id, syncedAt: _s, ...rest }: NoteDoc) => ({ id: _id, ...rest }))

  return Response.json({ notes, cursor: Math.max(since, startedAt - 5000) })
}

function isNote(n: unknown): n is Note {
  const x = n as Note
  return !!x && typeof x.id === 'string' && x.id.length <= 100 &&
    typeof x.content === 'string' && typeof x.updatedAt === 'string' && typeof x.createdAt === 'string'
}
