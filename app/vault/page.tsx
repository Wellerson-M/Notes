'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Fingerprint, Plus, ShieldCheck } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import NoteCard from '@/components/NoteCard'
import { notesRepo, useNotes } from '@/lib/repo'
import { syncNow } from '@/lib/sync'
import * as vault from '@/lib/vault'
import { useUIStore } from '@/store/ui'
import EmptyState from '@/components/EmptyState'
import { newNoteHref } from '@/lib/routes'
import PasswordChange from '@/components/PasswordChange'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 12,
  padding: '12px 14px',
  color: 'var(--text-primary)',
  fontSize: 15,
  outline: 'none',
  caretColor: 'var(--accent-amber)',
}

function PrimaryButton({ children, onClick, disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.96 }}
      className="flex items-center justify-center gap-2 w-full font-sans"
      style={{
        background: 'var(--accent-amber)', color: 'var(--on-accent)', border: 'none', borderRadius: 14,
        padding: '13px 20px', fontSize: 15, fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </motion.button>
  )
}

function LockBadge() {
  return (
    <motion.div
      animate={{ boxShadow: ['0 0 20px rgba(var(--gold-rgb), 0.1)', '0 0 40px rgba(var(--gold-rgb), 0.25)', '0 0 20px rgba(var(--gold-rgb), 0.1)'] }}
      transition={{ duration: 2, repeat: Infinity }}
      style={{
        width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-elevated)',
        border: '2px solid var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
      }}
    >
      <Lock size={32} style={{ color: 'var(--accent-gold)' }} />
    </motion.div>
  )
}

type Phase = 'checking' | 'setup' | 'locked' | 'open'

export default function VaultPage() {
  const { vaultLocked, showToast } = useUIStore()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [bio, setBio] = useState({ supported: false, enabled: false })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const allNotes = useNotes()
  const vaultNotes = (allNotes ?? []).filter((n) => n.inVault)

  useEffect(() => {
    void (async () => {
      // Num aparelho novo, o Vault criado em outro aparelho chega pelo sync
      if (!(await vault.isConfigured())) await syncNow()
      setConfigured(await vault.isConfigured())
      setBio({ supported: vault.biometricSupported(), enabled: await vault.biometricEnabled() })
    })()
  }, [])

  const phase: Phase = configured === null ? 'checking' : !configured ? 'setup' : vaultLocked ? 'locked' : 'open'

  /** Notas que já estavam no Vault antes da criptografia existir */
  const sealPlainNotes = async () => {
    const plain = (await notesRepo.list()).filter((n) => n.inVault && !n.cipher)
    for (const n of plain) await notesRepo.update(n.id, {})
    return plain.length
  }

  const handleSetup = async () => {
    setError('')
    if (password.length < 6) { setError('Use pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não conferem.'); return }
    setBusy(true)
    await vault.setup(password)
    const sealed = await sealPlainNotes()
    setPassword(''); setConfirm('')
    setConfigured(true)
    setBusy(false)
    showToast(sealed ? `Vault criado — ${sealed} nota${sealed > 1 ? 's' : ''} protegida${sealed > 1 ? 's' : ''}` : 'Vault criado')
  }

  const handleUnlock = async () => {
    if (!password) return
    setBusy(true); setError('')
    const ok = await vault.unlock(password)
    setBusy(false)
    if (!ok) { setError('Senha incorreta.'); return }
    setPassword('')
    void sealPlainNotes()
  }

  const handleBiometric = async () => {
    setBusy(true); setError('')
    const ok = await vault.unlockWithBiometric()
    setBusy(false)
    if (!ok) setError('Não deu para confirmar. Use a senha.')
  }

  const toggleBiometric = async () => {
    if (bio.enabled) {
      await vault.disableBiometric()
      setBio((b) => ({ ...b, enabled: false }))
      showToast('Biometria desligada neste aparelho')
    } else if (await vault.enableBiometric()) {
      setBio((b) => ({ ...b, enabled: true }))
      showToast('Biometria ligada neste aparelho')
    } else {
      showToast('Não deu para ativar a biometria aqui')
    }
  }

  return (
    <main style={{ minHeight: '100dvh', paddingBottom: 88 }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-5 pt-safe"
        style={{
          height: 56,
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
        }}
      >
        <div className="flex items-center gap-2">
          <Lock size={16} style={{ color: 'var(--accent-gold)' }} />
          <span className="font-sans font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)' }}>
            Vault
          </span>
        </div>
        {phase === 'open' && (
          <button
            onClick={vault.lock}
            className="touch-feedback text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: 12,
            }}
          >
            Trancar
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {phase === 'checking' ? null : phase !== 'open' ? (
          <motion.form
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={(e) => { e.preventDefault(); void (phase === 'setup' ? handleSetup() : handleUnlock()) }}
            className="flex flex-col items-center justify-center mx-auto"
            style={{ minHeight: 'calc(100dvh - 120px)', gap: 14, padding: 32, maxWidth: 380 }}
          >
            <LockBadge />
            <p className="font-serif" style={{ fontSize: 20, color: 'var(--text-primary)', fontWeight: 500, textAlign: 'center' }}>
              {phase === 'setup' ? 'Crie a senha do Vault' : 'Vault protegido'}
            </p>
            <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: '19px' }}>
              {phase === 'setup'
                ? 'As notas do Vault são cifradas no aparelho antes de ir para a nuvem. Sem esta senha, ninguém lê — nem você: não há como recuperá-la.'
                : 'Digite a senha do Vault para abrir.'}
            </p>

            <input
              type="password"
              autoComplete={phase === 'setup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="senha do Vault"
              className="font-sans"
              style={inputStyle}
            />
            {phase === 'setup' && (
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="repita a senha"
                className="font-sans"
                style={inputStyle}
              />
            )}
            {error && <p className="font-sans" style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}

            <PrimaryButton type="submit" disabled={busy || !password}>
              {busy ? (phase === 'setup' ? 'Criando...' : 'Abrindo...') : phase === 'setup' ? 'Criar Vault' : 'Abrir'}
            </PrimaryButton>

            {phase === 'locked' && bio.enabled && (
              <button
                type="button"
                onClick={handleBiometric}
                disabled={busy}
                className="touch-feedback flex items-center gap-2 font-sans"
                style={{ background: 'none', border: 'none', color: 'var(--accent-amber)', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 8 }}
              >
                <Fingerprint size={18} /> Usar biometria
              </button>
            )}
          </motion.form>
        ) : (
          <motion.div
            key="unlocked"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex flex-col gap-2 px-4 pt-4">
              <Link
                href={`${newNoteHref('text')}&vault=1`}
                className="touch-feedback flex items-center justify-center gap-2 rounded-xl py-3 font-sans"
                style={{ background: 'var(--accent-amber-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent-amber)', fontSize: 14, fontWeight: 500 }}
              >
                <Plus size={16} /> Nova nota no Vault
              </Link>
              {bio.supported && (
                <button
                  onClick={toggleBiometric}
                  className="touch-feedback flex items-center justify-between rounded-xl px-4 py-3 font-sans"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                >
                  <span className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Fingerprint size={15} style={{ color: 'var(--accent-gold)' }} /> Biometria neste aparelho
                  </span>
                  <span style={{ fontSize: 12, color: bio.enabled ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                    {bio.enabled ? 'ligada' : 'ligar'}
                  </span>
                </button>
              )}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <PasswordChange kind="vault" />
              </div>
              <p className="flex items-center gap-1.5 font-sans px-1" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <ShieldCheck size={12} /> cifrado no aparelho · tranca sozinho 1 min fora do app
              </p>
            </div>

            {vaultNotes.length === 0 ? (
              <EmptyState
                icon={<Lock size={32} style={{ color: 'var(--text-disabled)' }} />}
                message="vault vazio"
                paddingTop={48}
              />
            ) : (
              <div className="flex flex-col gap-3 px-4 py-4">
                {vaultNotes.map((note, i) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <NoteCard note={note} revealed />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </main>
  )
}
