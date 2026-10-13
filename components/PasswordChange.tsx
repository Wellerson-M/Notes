'use client'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, KeyRound } from 'lucide-react'
import * as vault from '@/lib/vault'
import { useUIStore } from '@/store/ui'

interface Props {
  /** `app` = senha de entrar no app (servidor); `vault` = senha que cifra as notas do Vault */
  kind: 'app' | 'vault'
}

const TEXT = {
  app: {
    label: 'Trocar senha do app',
    hint: 'Os outros aparelhos saem e entram de novo com a senha nova. As notas não mudam.',
    min: 8,
  },
  vault: {
    label: 'Trocar senha do Vault',
    hint: 'Todas as notas do Vault são cifradas de novo com a senha nova. Nos outros aparelhos, o Vault passa a abrir só com ela (e a digital precisa ser ligada de novo lá). Não há como recuperar uma senha esquecida.',
    min: 6,
  },
}

/** Linha que abre um formulário curto: senha atual, nova e repetir */
export default function PasswordChange({ kind }: Props) {
  const showToast = useUIStore((s) => s.showToast)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = TEXT[kind]

  const reset = () => { setCurrent(''); setNext(''); setRepeat(''); setError(null) }

  const submit = async () => {
    setError(null)
    if (next.length < t.min) { setError(`Use pelo menos ${t.min} caracteres.`); return }
    if (next !== repeat) { setError('As senhas novas não conferem.'); return }
    setBusy(true)
    try {
      if (kind === 'vault') {
        const r = await vault.changePassword(current, next)
        if (r === 'wrong') { setError('A senha atual do Vault não confere.'); return }
        if (r === 'error') { setError('Não deu para recifrar as notas. Nada foi mudado.'); return }
        showToast('Senha do Vault trocada')
      } else {
        const res = await fetch('/api/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current, next }),
        }).catch(() => null)
        if (!res) { setError('Sem conexão com o servidor.'); return }
        if (res.status === 401) { setError('Entre com a senha do app primeiro.'); return }
        const data = await res.json().catch(() => ({}))
        if (!res.ok) { setError(data.error ?? 'Não deu para trocar a senha.'); return }
        showToast('Senha do app trocada — os outros aparelhos vão pedir a nova')
      }
      reset()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const input = (value: string, onChange: (v: string) => void, placeholder: string, autoComplete: string) => (
    <input
      type="password"
      value={value}
      onChange={(e) => { onChange(e.target.value); setError(null) }}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="amber-caret font-sans w-full"
      style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10,
        padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', caretColor: 'var(--accent-amber)',
      }}
    />
  )

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        onClick={() => { setOpen((v) => !v); reset() }}
        className="touch-feedback flex items-center justify-between w-full px-5 py-3.5 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-sans" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
          <KeyRound size={14} style={{ color: kind === 'vault' ? 'var(--accent-gold)' : 'var(--accent-amber)' }} />
          {t.label}
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ display: 'flex' }}>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
            onSubmit={(e) => { e.preventDefault(); void submit() }}
          >
            <div className="flex flex-col gap-2 px-5 pb-4">
              {input(current, setCurrent, kind === 'vault' ? 'senha atual do Vault' : 'senha atual', 'current-password')}
              {input(next, setNext, `senha nova (mín. ${t.min})`, 'new-password')}
              {input(repeat, setRepeat, 'repita a senha nova', 'new-password')}
              <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '17px' }}>{t.hint}</p>
              {error && <p className="font-sans" style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
              <button
                type="submit"
                disabled={busy || !current || !next || !repeat}
                className="touch-feedback rounded-xl font-sans"
                style={{
                  height: 42, background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: 'pointer', opacity: busy || !current || !next || !repeat ? 0.6 : 1,
                }}
              >
                {busy ? (kind === 'vault' ? 'Recifrando...' : 'Trocando...') : 'Trocar senha'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
