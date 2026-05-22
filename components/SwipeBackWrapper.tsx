'use client'
import { useRef, useState, ReactNode } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Props {
  children: ReactNode
  onBack?: () => void
}

const EDGE_ZONE = 24   // px from left edge that activates swipe
const THRESHOLD = 0.38 // % of screen width to commit

export default function SwipeBackWrapper({ children, onBack }: Props) {
  const router = useRouter()
  const x = useMotionValue(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const active = useRef(false)

  // Background layer moves with parallax
  const bgX = useTransform(x, [0, 400], ['-25%', '0%'])
  const opacity = useTransform(x, [0, 200], [0, 0.6])

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    startX.current = touch.clientX
    active.current = touch.clientX <= EDGE_ZONE
    if (active.current) {
      setDragging(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!active.current) return
    const touch = e.touches[0]
    const dx = Math.max(0, touch.clientX - startX.current)
    x.set(dx)
  }

  const handleTouchEnd = () => {
    if (!active.current) return
    active.current = false
    setDragging(false)
    const current = x.get()
    const width = window.innerWidth

    if (current > width * THRESHOLD) {
      // Complete navigation back
      animate(x, width, { duration: 0.22, ease: [0.32, 0.72, 0, 1] }).then(() => {
        if (onBack) onBack()
        else router.back()
        x.set(0)
      })
    } else {
      // Spring back
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 })
    }
  }

  return (
    <div
      style={{ position: 'relative', overflow: 'hidden', minHeight: '100dvh' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Previous screen illusion (parallax bg) */}
      {dragging && (
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--bg-surface)',
            x: bgX,
            zIndex: 0,
          }}
        >
          <motion.div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', opacity }}
          />
        </motion.div>
      )}

      {/* Current screen */}
      <motion.div
        style={{
          x,
          zIndex: 1,
          position: 'relative',
          boxShadow: dragging ? '-8px 0 24px rgba(0,0,0,0.3)' : 'none',
          minHeight: '100dvh',
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
