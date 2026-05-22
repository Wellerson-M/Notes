'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Image, CheckSquare, Link2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  open: boolean
  onClose: () => void
  anchorX: number
  anchorY: number
}

const options = [
  { id: 'audio', Icon: Mic, label: 'Áudio', angle: 180, color: 'var(--accent-amber)' },
  { id: 'photo', Icon: Image, label: 'Foto', angle: 135, color: 'var(--success)' },
  { id: 'task', Icon: CheckSquare, label: 'Tarefa', angle: 45, color: 'var(--accent-gold)' },
  { id: 'link', Icon: Link2, label: 'Link', angle: 0, color: 'var(--text-secondary)' },
]

function getPosition(angle: number, radius = 76) {
  const rad = (angle * Math.PI) / 180
  return {
    x: Math.cos(rad) * radius,
    y: -Math.sin(rad) * radius,
  }
}

export default function RadialMenu({ open, onClose, anchorX, anchorY }: Props) {
  const router = useRouter()

  const handleOption = (id: string) => {
    onClose()
    router.push(`/note/new?mode=${id}`)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 55,
              background: 'rgba(17,18,16,0.4)',
            }}
          />

          {/* Radial options */}
          {options.map(({ id, Icon, label, angle, color }, i) => {
            const { x, y } = getPosition(angle)
            return (
              <motion.button
                key={id}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                animate={{ opacity: 1, x, y, scale: 1 }}
                exit={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                transition={{ duration: 0.25, delay: i * 0.04, ease: [0.32, 0.72, 0, 1] }}
                onClick={() => handleOption(id)}
                style={{
                  position: 'fixed',
                  left: anchorX - 24,
                  bottom: anchorY - 24,
                  zIndex: 60,
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  border: `1.5px solid ${color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  cursor: 'pointer',
                }}
              >
                <Icon size={18} style={{ color }} />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1 }}>
                  {label}
                </span>
              </motion.button>
            )
          })}
        </>
      )}
    </AnimatePresence>
  )
}
