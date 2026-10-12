'use client'
import { useState } from 'react'
import { syncNow } from '@/lib/sync'
import { useUIStore } from '@/store/ui'

/**
 * Login com a senha do app ali mesmo, onde a IA pediu — sem ir até Ajustes.
 * Depois de conectar, sincroniza e avisa quem chamou (para tentar de novo).
 */
export default function ConnectInline({ onConnected }: { onConnected?: () => void }) {
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'error' | 'done'>('idle')

  const submit = async () => {
    if (!password) return
    setState('busy')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null)
    if (!res?.ok) { setState('error'); return }
    setPassword('')
    setState('done')
    useUIStore.getState().showToast('Conectado — sincronizando...')
    void syncNow()
    onConnected?.()
  }

  if (state === 'done') {
    return (
      <p className="font-sans" style={{ fontSize: 13, color: 'var(--success)' }}>
        conectado ✓ {onConnected ? '' : '— pode tentar de novo'}
      </p>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex flex-col gap-2">
      <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '19px' }}>
        A IA precisa que este aparelho esteja conectado. Digite a senha do app (só uma vez por aparelho).
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (state === 'error') setState('idle') }}
          placeholder="senha do app"
          className="flex-1 amber-caret font-sans"
          style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10,
            padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
            caretColor: 'var(--accent-amber)', minWidth: 0,
          }}
        />
        <button
          type="submit"
          disabled={state === 'busy' || !password}
          className="touch-feedback rounded-xl px-4 font-sans"
          style={{
            background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 600, border: 'none',
            cursor: 'pointer', opacity: state === 'busy' || !password ? 0.6 : 1,
          }}
        >
          {state === 'busy' ? '...' : 'Entrar'}
        </button>
      </div>
      {state === 'error' && <p className="font-sans" style={{ fontSize: 12, color: 'var(--danger)' }}>Senha incorreta ou sem conexão.</p>}
    </form>
  )
}
