'use client'
import { useEffect, useRef, ReactNode } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Props {
  children: ReactNode
  onBack?: () => void
}

/** Onde o gesto pode começar: metade esquerda da tela (a borda é do sistema no Android com gestos) */
const START_ZONE = 0.5
/** Distância para decidir se o gesto é horizontal (voltar) ou vertical (rolar) */
const LOCK_PX = 10
/** Soltar depois de 30% da largura volta; um peteleco rápido também */
const COMMIT = 0.3
const FLICK_PX = 50
const FLICK_MS = 260

/**
 * Deslizar para a direita para voltar, como no iPhone: a tela acompanha o dedo 1:1, com a
 * anterior (sugerida) aparecendo por baixo. Não começa em campos de texto nem em elementos
 * que já arrastam na horizontal (cards da timeline, folhas).
 */
export default function SwipeBackWrapper({ children, onBack }: Props) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const shade = useTransform(x, [0, 400], [0.35, 0])
  const under = useTransform(x, [0, 400], ['-18%', '0%'])
  const shadow = useTransform(x, (v) => (v > 1 ? '-10px 0 30px rgba(0,0,0,0.28)' : 'none'))
  const showUnder = useTransform(x, (v) => (v > 1 ? 1 : 0))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let start: { x: number; y: number; t: number } | null = null
    let mode: 'undecided' | 'back' | 'ignore' = 'ignore'

    const blocked = (target: EventTarget | null) => {
      const t = target as HTMLElement | null
      return !!t?.closest?.('textarea, input, [contenteditable="true"], [data-no-swipe-back], [role="dialog"]')
    }

    const onStart = (e: TouchEvent) => {
      const p = e.touches[0]
      if (e.touches.length !== 1 || p.clientX > window.innerWidth * START_ZONE || blocked(e.target)) {
        mode = 'ignore'
        return
      }
      start = { x: p.clientX, y: p.clientY, t: performance.now() }
      mode = 'undecided'
    }

    const onMove = (e: TouchEvent) => {
      if (mode === 'ignore' || !start) return
      const p = e.touches[0]
      const dx = p.clientX - start.x
      const dy = p.clientY - start.y
      if (mode === 'undecided') {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return
        // Só vale se for claramente para a direita
        mode = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.4 ? 'back' : 'ignore'
        if (mode === 'ignore') return
        start = { ...start, x: p.clientX - 1 }
      }
      if (e.cancelable) e.preventDefault() // segura a rolagem enquanto volta
      x.set(Math.max(0, p.clientX - start.x))
    }

    const onEnd = (e: TouchEvent) => {
      if (mode !== 'back' || !start) { mode = 'ignore'; return }
      mode = 'ignore'
      const width = window.innerWidth
      const dx = x.get()
      const quick = performance.now() - start.t < FLICK_MS && dx > FLICK_PX
      const lastX = e.changedTouches[0]?.clientX ?? 0
      const stillForward = lastX - start.x >= dx - 4
      if (dx > width * COMMIT || (quick && stillForward)) {
        try { navigator.vibrate?.(8) } catch { /* sem vibração */ }
        void animate(x, width, { duration: 0.18, ease: [0.32, 0.72, 0, 1] }).then(() => {
          if (onBack) onBack()
          else router.back()
        })
      } else {
        void animate(x, 0, { type: 'spring', stiffness: 520, damping: 42 })
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [x, onBack, router])

  return (
    <div ref={ref} style={{ position: 'relative', overflow: 'hidden', minHeight: '100dvh' }}>
      {/* Sugestão da tela anterior por baixo, com leve paralaxe */}
      <motion.div
        aria-hidden
        style={{ position: 'fixed', inset: 0, background: 'var(--bg-surface)', x: under, opacity: showUnder, zIndex: 0, pointerEvents: 'none' }}
      >
        <motion.div style={{ position: 'absolute', inset: 0, background: '#000', opacity: shade }} />
      </motion.div>

      {/* Tela atual */}
      <motion.div style={{ x, zIndex: 1, position: 'relative', boxShadow: shadow, minHeight: '100dvh', backgroundColor: 'var(--bg-base)', backgroundImage: 'var(--ambient)', backgroundAttachment: 'fixed' }}>
        {children}
      </motion.div>
    </div>
  )
}
