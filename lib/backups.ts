import 'server-only'
import { mongoDb, notesCollection, type NoteDoc } from './mongo'
import type { Note } from './types'

/**
 * Cópias automáticas no servidor: uma foto de todas as notas por dia (as do Vault vão cifradas,
 * como estão no Atlas), guardadas por KEEP_DAYS dias na coleção `backups`. Protegem contra apagar
 * sem querer, um aparelho que sincroniza lixo ou um bug — não contra perder a conta do Atlas
 * (para isso, o backup em arquivo fora daqui: Ajustes → Seus dados).
 */

const KEEP_DAYS = 14
/** Um documento do Mongo aceita até 16 MB */
const MAX_BYTES = 15 * 1024 * 1024
/** Cada instância confere no máximo a cada 30 min (o sync chama isto toda hora) */
const CHECK_EVERY_MS = 30 * 60 * 1000

type BackupDoc = { _id: string; createdAt: number; count: number; bytes: number; data: string }

const g = globalThis as unknown as { lastBackupCheck?: number }

async function backupsCollection() {
  return (await mongoDb()).collection<BackupDoc>('backups')
}

const today = () => new Date().toISOString().slice(0, 10)

/** Faz a cópia de hoje se ainda não existir. Barato quando já existe (uma busca pelo _id). */
export async function dailyBackup(): Promise<'done' | 'exists' | 'skipped'> {
  if (g.lastBackupCheck && Date.now() - g.lastBackupCheck < CHECK_EVERY_MS) return 'skipped'
  g.lastBackupCheck = Date.now()
  const col = await backupsCollection()
  const day = today()
  if (await col.findOne({ _id: day }, { projection: { _id: 1 } })) return 'exists'

  const docs = await (await notesCollection()).find({ deleted: { $ne: true } }).toArray()
  const notes: Note[] = docs.map(({ _id, syncedAt: _s, ...rest }: NoteDoc) => ({ id: _id, ...rest }))
  const data = JSON.stringify(notes)
  if (data.length > MAX_BYTES) {
    console.error(`[backup] ${data.length} bytes: grande demais para uma cópia no Atlas`)
    return 'skipped'
  }
  try {
    await col.insertOne({ _id: day, createdAt: Date.now(), count: notes.length, bytes: data.length, data })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return 'exists' // outra instância fez agora
    throw err
  }
  const old = await col.find({}, { projection: { _id: 1 } }).sort({ _id: -1 }).skip(KEEP_DAYS).toArray()
  if (old.length) await col.deleteMany({ _id: { $in: old.map((o) => o._id) } })
  return 'done'
}

export async function listBackups() {
  const rows = await (await backupsCollection()).find({}, { projection: { data: 0 } }).sort({ _id: -1 }).toArray()
  return rows.map((r) => ({ day: r._id, createdAt: r.createdAt, count: r.count, bytes: r.bytes }))
}

export async function getBackup(day: string): Promise<string | null> {
  return (await (await backupsCollection()).findOne({ _id: day }))?.data ?? null
}
