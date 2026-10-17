'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe } from 'lucide-react'
import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import { normalizeUrl } from '@/lib/links'

interface Props {
  open: boolean
  /** Texto selecionado na nota: vira o texto do link (ou o endereço, se já for um) */
  initial: string
  onInsert: (url: string, text: string) => void
  onClose: () => void
}

/** Folha para inserir um link da web no ponto do cursor: `[texto](endereço)` ou o endereço puro */
export default function LinkInsertSheet({ open, initial, onInsert, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && <Sheet key="link" initial={initial} onInsert={onInsert} onClose={onClose} />}
    </AnimatePresence>
  )
}

function Sheet({ initial, onInsert, onClose }: Omit<Props, 'open'>) {
  const inset = useKeyboardInset()
  const startsAsUrl = !!normalizeUrl(initial) && !/\s/.test(initial.trim())
  const [url, setUrl] = useState(startsAsUrl ? initial.trim() : '')
  const [text, setText] = useState(startsAsUrl ? '' : initial.trim())
  const href = normalizeUrl(url)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => { if (href) onInsert(href, text.trim()) }

  const field = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10,
    padding: '0 12px', height: 42, fontSize: 15, color: 'var(--text-primary)', outline: 'none', width: '100%',
  } as const

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(var(--bg-rgb), 0.5)' }}
      />
      <motion.form
        className="app-bar"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onSubmit={(e) => { e.preventDefault(); submit() }}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: inset, zIndex: 75,
          background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border-default)',
          padding: '16px 20px', paddingBottom: inset ? 16 : 'max(env(safe-area-inset-bottom, 0px), 16px)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        <div className="flex items-center gap-2 font-sans" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          <Globe size={16} style={{ color: 'var(--accent-amber)' }} /> Inserir link
        </div>
        <input
          autoFocus
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="endereço (ex.: site.com.br)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="font-sans"
          style={field}
        />
        <input
          placeholder="texto do link (opcional)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-sans"
          style={field}
        />
        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
          <span className="font-sans line-clamp-1 flex-1" style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 0 }}>
            {href ?? 'cole ou digite um endereço'}
          </span>
          <button type="button" onClick={onClose} className="touch-feedback font-sans" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '8px 10px' }}>
            cancelar
          </button>
          <button
            type="submit"
            disabled={!href}
            className="touch-feedback font-sans"
            style={{
              background: href ? 'var(--accent-amber)' : 'var(--bg-elevated)', color: href ? 'var(--on-accent)' : 'var(--text-disabled)',
              border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: href ? 'pointer' : 'default',
            }}
          >
            Inserir
          </button>
        </div>
      </motion.form>
    </>
  )
}
