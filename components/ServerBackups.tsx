'use client'
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

type Row = { day: string; createdAt: number; count: number; bytes: number }

/** Cópias automáticas que o servidor faz uma vez por dia (14 dias). Baixar = mesmo formato do backup .json. */
export default function ServerBackups({ connected }: { connected: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!connected) return
    // Garante a de hoje e depois lista
    fetch('/api/backup', { method: 'POST' })
      .catch(() => null)
      .then(() => fetch('/api/backup', { cache: 'no-store' }))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { backups: Row[] }) => setRows(d.backups))
      .catch(() => setError(true))
  }, [connected])

  if (!connected) return null

  return (
    <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Cópias automáticas no servidor (uma por dia, 14 dias)
      </span>
      {error ? (
        <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Não deu para ler as cópias agora.</p>
      ) : !rows ? (
        <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>lendo...</p>
      ) : !rows.length ? (
        <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>A primeira cópia sai no próximo sync.</p>
      ) : (
        <div className="flex flex-col mt-2">
          {rows.slice(0, 7).map((r) => (
            <a
              key={r.day}
              href={`/api/backup?day=${r.day}`}
              download
              className="touch-feedback flex items-center justify-between py-2 font-sans"
              style={{ fontSize: 13, color: 'var(--text-secondary)' }}
            >
              <span>
                {new Date(`${r.day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                <span style={{ color: 'var(--text-muted)' }}> · {r.count} notas · {Math.max(1, Math.round(r.bytes / 1024))} KB</span>
              </span>
              <Download size={14} style={{ color: 'var(--accent-amber)' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
