'use client'
import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import RadialMenu from './RadialMenu'

export default function FAB() {
  const router = useRouter()
  const [radialOpen, setRadialOpen] = useState(false)
  const [anchor, setAnchor] = useState({ x: 0, y: 0 })
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)
  const fabRef = useRef<HTMLButtonElement>(null)

  const startLongPress = useCallback(() => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      if (fabRef.current) {
        const rect = fabRef.current.getBoundingClientRect()
        setAnchor({
          x: rect.left + rect.width / 2,
          y: window.innerHeight - rect.top,
        })
      }
      setRadialOpen(true)
    }, 300)
  }, [])

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleClick = useCallback(() => {
    if (!didLongPress.current) {
      router.push('/note/new')
    }
  }, [router])

  return (
    <>
      <motion.button
        ref={fabRef}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onClick={handleClick}
        style={{
          position: 'fixed',
          bottom: 'calc(64px + 16px + env(safe-area-inset-bottom, 0px))',
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--accent-amber)',
          border: 'none',
          boxShadow: '0 4px 20px rgba(232, 165, 71, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 45,
        }}
        whileTap={{ scale: 0.92 }}
      >
        <Plus size={24} color="#111210" strokeWidth={2.5} />
      </motion.button>

      <RadialMenu
        open={radialOpen}
        onClose={() => setRadialOpen(false)}
        anchorX={anchor.x}
        anchorY={anchor.y}
      />
    </>
  )
}
