'use client'
import { useUIStore, SyncStatus } from '@/store/ui'

interface Props {
  status?: SyncStatus
}

export default function SyncIndicator({ status }: Props) {
  const storeStatus = useUIStore((s) => s.syncStatus)
  const s = status ?? storeStatus

  const color =
    s === 'ok' ? 'var(--accent-gold)' :
    s === 'syncing' ? 'var(--accent-amber)' :
    'var(--danger)'

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
      aria-label={
        s === 'ok' ? 'sincronizado' :
        s === 'syncing' ? 'sincronizando' :
        'erro de sincronização'
      }
    />
  )
}
