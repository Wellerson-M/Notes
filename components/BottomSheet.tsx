'use client'
import { useEffect } from 'react'
import { motion } from 'framer-motion'

export default function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  // No PC, Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(17,18,16,0.6)',
          zIndex: 60,
        }}
      />
      <motion.div
        className="app-bar"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bg-surface)',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid var(--border-default)',
          zIndex: 65,
          maxHeight: '70vh',
          overflowY: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            fechar
          </button>
        </div>
        {children}
      </motion.div>
    </>
  )
}
