'use client'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  visible: boolean
  onBold?: () => void
  onItalic?: () => void
  onStrike?: () => void
  onLink?: () => void
  onCode?: () => void
  onAI?: () => void
}

export default function FloatingToolbar({ visible, onBold, onItalic, onStrike, onLink, onCode, onAI }: Props) {
  const actions = [
    { label: 'B', style: { fontWeight: 700 }, onClick: onBold, title: 'Negrito' },
    { label: 'I', style: { fontStyle: 'italic' }, onClick: onItalic, title: 'Itálico' },
    { label: 'S', style: { textDecoration: 'line-through' }, onClick: onStrike, title: 'Tachado' },
    { label: '🔗', style: {}, onClick: onLink, title: 'Link' },
    { label: '`·`', style: { fontFamily: 'monospace', fontSize: 11 }, onClick: onCode, title: 'Código' },
    { label: '✨ IA', style: { color: 'var(--accent-amber)', fontSize: 11, fontWeight: 600 }, onClick: onAI, title: 'IA' },
  ]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18 }}
          className="noise-card"
          style={{
            position: 'absolute',
            top: -44,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            padding: '6px 10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 100,
            whiteSpace: 'nowrap',
          }}
        >
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              title={a.title}
              className="touch-feedback"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 6,
                fontSize: 13,
                ...a.style,
              }}
            >
              {a.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
