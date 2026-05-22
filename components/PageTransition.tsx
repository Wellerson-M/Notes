'use client'
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  layoutId?: string
}

export default function PageTransition({ children, layoutId }: Props) {
  return (
    <motion.div
      layoutId={layoutId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        duration: 0.32,
        ease: [0.32, 0.72, 0, 1],
      }}
      style={{ minHeight: '100dvh' }}
    >
      {children}
    </motion.div>
  )
}

export function NotePageTransition({ children, noteId }: { children: ReactNode; noteId: string }) {
  return (
    <motion.div
      layoutId={`note-card-${noteId}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.32,
        ease: [0.32, 0.72, 0, 1],
      }}
      style={{ minHeight: '100dvh', background: 'var(--bg-base)' }}
    >
      {children}
    </motion.div>
  )
}
