'use client'
import { useUIStore, SyncStatus } from '@/store/ui'

interface Props {
  status?: SyncStatus
}

const LABELS: Record<SyncStatus, string> = {
  ok: 'sincronizado',
  syncing: 'sincronizando',
  error: 'erro de sincronização',
  offline: 'sem internet — salvo no aparelho',
  unauthorized: 'sync desligado — entre em Ajustes',
}

export default function SyncIndicator({ status }: Props) {
  const storeStatus = useUIStore((s) => s.syncStatus)
  const s = status ?? storeStatus

  const color =
    s === 'ok' ? 'var(--accent-gold)' :
    s === 'syncing' ? 'var(--accent-amber)' :
    s === 'error' ? 'var(--danger)' :
    'var(--text-disabled)'

  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
      className={s === 'syncing' ? 'pulse-dot-sync' : ''}
      role="img"
      aria-label={LABELS[s]}
      title={LABELS[s]}
    />
  )
}
