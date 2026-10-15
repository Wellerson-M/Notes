'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ParticleField from './ParticleField'

const DURATION = 1000
/** Mostra a splash uma vez por sessão, não a cada navegação. */
const SEEN_KEY = 'splash-seen'

export default function Splash() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1'
    } catch {
      // sessionStorage pode falhar em modo privado — segue sem splash
      return
    }
    if (seen) return

    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {}

    // rAF em vez de setState direto no effect: evita cascata de render e
    // mantem o primeiro paint igual ao do servidor (sem splash, sem mismatch).
    const raf = requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => setVisible(false), DURATION)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'var(--bg-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Campo de partículas que deriva com o giroscópio, atrás do logo */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <ParticleField mode="splash" />
          </div>

          <motion.span
            className="font-serif"
            animate={{ opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'relative',
              fontSize: 34,
              fontWeight: 500,
              color: 'var(--accent-amber)',
              letterSpacing: 0.5,
            }}
          >
            Grafite Notas
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
