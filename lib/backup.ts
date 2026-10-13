'use client'
import { db, getMeta, setMeta } from './db'

/**
 * Backup em arquivo, feito no aparelho: todas as notas como estão gravadas (as do Vault vão
 * cifradas). "Enviar" abre o compartilhar do sistema (Google Drive, e-mail, WhatsApp...);
 * onde não houver, baixa o arquivo.
 */

const stamp = () => new Date().toISOString().slice(0, 10)

async function backupFile(): Promise<{ file: File; count: number; sealed: number }> {
  const rows = (await db.notes.toArray()).filter((n) => !n.deleted).map(({ dirty: _d, ...n }) => n)
  const file = new File([JSON.stringify(rows, null, 2)], `grafite-notas-${stamp()}.json`, { type: 'application/json' })
  return { file, count: rows.length, sealed: rows.filter((n) => n.cipher).length }
}

function download(file: File) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export type BackupResult = { count: number; sealed: number; via: 'share' | 'download' } | null

/** `share`: tenta o compartilhar do sistema (para salvar no Drive). Devolve null se a pessoa cancelar. */
export async function saveBackup({ share }: { share: boolean }): Promise<BackupResult> {
  const { file, count, sealed } = await backupFile()
  if (share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup das notas' })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      download(file)
      await setMeta('lastBackupAt', Date.now())
      return { count, sealed, via: 'download' }
    }
    await setMeta('lastBackupAt', Date.now())
    return { count, sealed, via: 'share' }
  }
  download(file)
  await setMeta('lastBackupAt', Date.now())
  return { count, sealed, via: 'download' }
}

export const canShareFiles = () =>
  typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [new File(['{}'], 'teste.json', { type: 'application/json' })] })

export const lastBackupAt = () => getMeta<number>('lastBackupAt')

/** Passou do prazo sem backup em arquivo (e há notas para perder)? Lembra no máximo 1 vez por dia. */
export async function backupReminderDue(maxDays = 14): Promise<number | null> {
  const last = await lastBackupAt()
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null
  if (days !== null && days < maxDays) return null
  if ((await db.notes.filter((n) => !n.deleted).count()) < 5) return null
  const nagged = await getMeta<number>('backupNagAt')
  if (nagged && Date.now() - nagged < 86400000) return null
  await setMeta('backupNagAt', Date.now())
  return days ?? -1
}
