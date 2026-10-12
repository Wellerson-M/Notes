'use client'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '@/store/ui'

/** Toast global — dispare com `useUIStore.getState().showToast(...)` */
export default function Toast() {
  const toast = useUIStore((s) => s.toast)
  const hideToast = useUIStore((s) => s.hideToast)

  useEffect(() => {
    if (!toast || toast.persistent) return
    const t = setTimeout(hideToast, toast.actionLabel ? 5000 : 2500)
    return () => clearTimeout(t)
  }, [toast, hideToast])

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ y: 80, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 80, opacity: 0, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          role="status"
          className="flex items-center gap-4"
          style={{
            position: 'fixed',
            bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-amber)',
            borderRadius: 12,
            padding: '10px 16px 10px 20px',
            fontSize: 13,
            color: 'var(--text-primary)',
            zIndex: 90,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              onClick={() => { toast.onAction?.(); hideToast() }}
              style={{ color: 'var(--accent-amber)', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {toast.actionLabel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
