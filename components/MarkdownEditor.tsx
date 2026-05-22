'use client'
import { useRef, useState, useCallback, KeyboardEvent } from 'react'
import AmberCaret from './AmberCaret'
import FloatingToolbar from './FloatingToolbar'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    // Heading
    const h1 = line.match(/^# (.+)/)
    if (h1) return <div key={i} style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-serif)' }}>{h1[1]}</div>
    const h2 = line.match(/^## (.+)/)
    if (h2) return <div key={i} style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 12, marginBottom: 4, fontFamily: 'var(--font-serif)' }}>{h2[1]}</div>
    const h3 = line.match(/^### (.+)/)
    if (h3) return <div key={i} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8, fontFamily: 'var(--font-serif)' }}>{h3[1]}</div>

    // Blockquote
    const bq = line.match(/^> (.+)/)
    if (bq) return <div key={i} className="prose-blockquote">{bq[1]}</div>

    // HR
    if (line === '---') return <div key={i} className="prose-hr" />

    // Task checkbox
    const taskDone = line.match(/^- \[x\] (.+)/i)
    if (taskDone) return (
      <div key={i} className="flex items-center gap-2 my-1">
        <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="#111210" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: 15, fontFamily: 'var(--font-serif)' }}>{taskDone[1]}</span>
      </div>
    )
    const taskOpen = line.match(/^- \[ \] (.+)/)
    if (taskOpen) return (
      <div key={i} className="flex items-center gap-2 my-1">
        <div style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border-strong)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: 'var(--font-serif)' }}>{taskOpen[1]}</span>
      </div>
    )

    // List item
    const li = line.match(/^- (.+)/)
    if (li) return (
      <div key={i} className="flex items-start gap-2 my-0.5">
        <span style={{ color: 'var(--accent-amber)', marginTop: 8, fontSize: 8, flexShrink: 0 }}>●</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: '26px', fontFamily: 'var(--font-serif)' }}>{inlineMarkdown(li[1])}</span>
      </div>
    )

    // Empty line
    if (!line.trim()) return <div key={i} style={{ height: 12 }} />

    // Normal paragraph
    return (
      <div key={i} style={{ color: 'var(--text-primary)', fontSize: 17, lineHeight: '30px', fontFamily: 'var(--font-serif)', marginBottom: 2 }}>
        {inlineMarkdown(line)}
      </div>
    )
  })
}

function inlineMarkdown(text: string): React.ReactNode {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[.+?\]\(.+?\))/)
  return parts.map((part, i) => {
    if (part.match(/^\*\*(.+)\*\*$/)) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.match(/^_(.+)_$/)) return <em key={i}>{part.slice(1, -1)}</em>
    if (part.match(/^`(.+)`$/)) return <code key={i} style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, fontSize: 13 }}>{part.slice(1, -1)}</code>
    const link = part.match(/^\[(.+?)\]\((.+?)\)$/)
    if (link) return <a key={i} href={link[2]} style={{ color: 'var(--accent-amber)', textDecoration: 'underline', textDecorationColor: 'rgba(232,165,71,0.4)' }}>{link[1]}</a>
    return part
  })
}

export default function MarkdownEditor({ value, onChange, placeholder = 'Escreva aqui...' }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Auto-continue list on Enter
    if (e.key === 'Enter') {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const lines = value.slice(0, start).split('\n')
      const currentLine = lines[lines.length - 1]

      const taskMatch = currentLine.match(/^(- \[ \] )/)
      const listMatch = currentLine.match(/^(- )/)

      if (taskMatch) {
        e.preventDefault()
        const newVal = value.slice(0, start) + '\n- [ ] ' + value.slice(start)
        onChange(newVal)
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = start + 7
          }
        }, 0)
      } else if (listMatch && currentLine.trim() !== '-') {
        e.preventDefault()
        const newVal = value.slice(0, start) + '\n- ' + value.slice(start)
        onChange(newVal)
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = start + 3
          }
        }, 0)
      }
    }
  }, [value, onChange])

  const handleSelect = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    const sel = textarea.selectionEnd - textarea.selectionStart
    setToolbarVisible(sel > 0)
  }

  return (
    <div style={{ position: 'relative' }}>
      {isEditing ? (
        <AmberCaret>
          <div style={{ position: 'relative' }}>
            <FloatingToolbar
              visible={toolbarVisible}
              onBold={() => {
                const ta = textareaRef.current
                if (!ta) return
                const s = ta.selectionStart, e = ta.selectionEnd
                const sel = value.slice(s, e)
                onChange(value.slice(0, s) + `**${sel}**` + value.slice(e))
                setToolbarVisible(false)
              }}
              onItalic={() => {
                const ta = textareaRef.current
                if (!ta) return
                const s = ta.selectionStart, e = ta.selectionEnd
                const sel = value.slice(s, e)
                onChange(value.slice(0, s) + `_${sel}_` + value.slice(e))
                setToolbarVisible(false)
              }}
              onCode={() => {
                const ta = textareaRef.current
                if (!ta) return
                const s = ta.selectionStart, e = ta.selectionEnd
                const sel = value.slice(s, e)
                onChange(value.slice(0, s) + `\`${sel}\`` + value.slice(e))
                setToolbarVisible(false)
              }}
            />
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onBlur={() => {
                setIsEditing(false)
                setToolbarVisible(false)
              }}
              autoFocus
              placeholder={placeholder}
              className="amber-caret w-full"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-serif)',
                fontSize: 17,
                lineHeight: '30px',
                padding: 0,
                minHeight: 300,
                caretColor: 'var(--accent-amber)',
              }}
              rows={Math.max(10, value.split('\n').length + 2)}
            />
          </div>
        </AmberCaret>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          style={{ minHeight: 300, cursor: 'text' }}
        >
          {value ? (
            <div>{renderMarkdown(value)}</div>
          ) : (
            <span
              className="font-serif italic"
              style={{ color: 'var(--text-disabled)', fontSize: 17, lineHeight: '30px' }}
            >
              {placeholder}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
