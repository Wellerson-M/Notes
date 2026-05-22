'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Fingerprint } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import NoteCard from '@/components/NoteCard'
import { mockNotes } from '@/mocks/notes'
import { useUIStore } from '@/store/ui'

const vaultNotes = mockNotes.filter((n) => n.inVault)

export default function VaultPage() {
  const { vaultLocked, setVaultLocked } = useUIStore()
  const [unlocking, setUnlocking] = useState(false)

  const handleUnlock = () => {
    setUnlocking(true)
    setTimeout(() => {
      setVaultLocked(false)
      setUnlocking(false)
    }, 800)
  }

  const handleLock = () => setVaultLocked(true)

  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100dvh', paddingBottom: 88 }}>
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
        {!vaultLocked && (
          <button
            onClick={handleLock}
            className="touch-feedback text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Trancar
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {vaultLocked ? (
          /* Locked state */
          <motion.div
            key="locked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center"
            style={{ minHeight: 'calc(100dvh - 120px)', gap: 16, padding: 32 }}
          >
            {/* Lock icon with glow */}
            <motion.div
              animate={{ boxShadow: ['0 0 20px rgba(212,175,55,0.1)', '0 0 40px rgba(212,175,55,0.25)', '0 0 20px rgba(212,175,55,0.1)'] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '2px solid var(--accent-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <Lock size={32} style={{ color: 'var(--accent-gold)' }} />
            </motion.div>

            <p className="font-serif" style={{ fontSize: 20, color: 'var(--text-primary)', fontWeight: 500, textAlign: 'center' }}>
              Vault protegido
            </p>
            <p className="font-sans" style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>
              toque para autenticar
            </p>

            <motion.button
              onClick={handleUnlock}
              disabled={unlocking}
              whileTap={{ scale: 0.96 }}
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--accent-amber)',
                color: '#111210',
                border: 'none',
                borderRadius: 16,
                padding: '14px 32px',
                fontSize: 15,
                fontWeight: 600,
                cursor: unlocking ? 'default' : 'pointer',
                opacity: unlocking ? 0.7 : 1,
              }}
            >
              <Fingerprint size={20} />
              {unlocking ? 'Autenticando...' : 'Usar biometria'}
            </motion.button>
          </motion.div>
        ) : (
          /* Unlocked state */
          <motion.div
            key="unlocked"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            {vaultNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80 }}>
                <Lock size={32} style={{ color: 'var(--text-disabled)', marginBottom: 12 }} />
                <p className="font-serif italic" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                  Vault vazio
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 px-4 py-4">
                {vaultNotes.map((note, i) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <NoteCard note={{ ...note, inVault: false }} />
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
