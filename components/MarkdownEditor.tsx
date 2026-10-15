'use client'
import { useRef, useState, useCallback, useEffect, useImperativeHandle, useLayoutEffect, Fragment, cloneElement, isValidElement, type KeyboardEvent, type Ref } from 'react'
import AmberCaret from './AmberCaret'
import FloatingToolbar from './FloatingToolbar'
import WikilinkAutocomplete from './WikilinkAutocomplete'
import WikiLink from './WikiLink'
import EditorAccessory from './EditorAccessory'
import { parseTaskLine } from '@/lib/notes'

/** Controle do editor por fora (ditado, templates): insere no ponto onde o cursor estava */
export type EditorHandle = {
  /** `block`: o texto entra numa linha própria (templates, listas) */
  insert: (text: string, opts?: { block?: boolean }) => void
  /** Sai da edição (mesmo que tocar fora) — continua na nota */
  done: () => void
  /** Texto antes do cursor (contexto para o ditado pela IA) */
  before: () => string
}

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  ref?: Ref<EditorHandle>
  /** Avisado quando o teclado/edição abre e fecha (a tela troca a barra de baixo) */
  onEditingChange?: (editing: boolean) => void
  /** Botão "ditar" da barra acima do teclado */
  onDictate?: () => void
}

export function renderMarkdown(text: string, onToggleTask?: (lineIndex: number) => void): React.ReactNode[] {
  return text.split('\n').map((line, i) => <Fragment key={i}>{withLine(renderLine(line, i, onToggleTask), i)}</Fragment>)
}

/** Cada linha leva `data-line`: tocar nela abre o editor com o cursor ali (e não no topo) */
function withLine(node: React.ReactNode, i: number): React.ReactNode {
  return isValidElement(node) ? cloneElement(node as React.ReactElement<Record<string, unknown>>, { 'data-line': i }) : node
}

function renderLine(line: string, i: number, onToggleTask?: (lineIndex: number) => void): React.ReactNode {
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

  // Tarefa: a linha inteira (com folga em cima e embaixo) marca/desmarca — tocar perto da
  // caixinha nunca abre o teclado
  const task = parseTaskLine(line)
  if (task) return (
    <div
      key={i}
      role="checkbox"
      aria-checked={task.done}
      className="flex items-center gap-3"
      style={{ cursor: 'pointer', padding: '7px 0', margin: '-3px 0', WebkitTapHighlightColor: 'transparent' }}
      onClick={(e) => { e.stopPropagation(); onToggleTask?.(i) }}
    >
      <div
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: task.done ? 'var(--success)' : 'transparent',
          border: task.done ? 'none' : '1.5px solid var(--border-strong)',
          transition: 'background 150ms, border-color 150ms',
        }}
      >
        {task.done && (
          <svg width="10" height="8" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" style={{ stroke: 'var(--on-accent)' }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </div>
      <span style={{
        color: task.done ? 'var(--text-muted)' : 'var(--text-secondary)',
        textDecoration: task.done ? 'line-through' : 'none',
        fontSize: 15, fontFamily: 'var(--font-serif)',
      }}>
        {inlineMarkdown(task.text)}
      </span>
    </div>
  )

  // Lista numerada
  const ol = line.match(/^(\d+)\. (.+)/)
  if (ol) return (
    <div key={i} className="flex items-start gap-2 my-0.5">
      <span style={{ color: 'var(--accent-amber)', fontSize: 14, lineHeight: '26px', minWidth: 16, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>{ol[1]}.</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: '26px', fontFamily: 'var(--font-serif)' }}>{inlineMarkdown(ol[2])}</span>
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
}

function inlineMarkdown(text: string): React.ReactNode {
  // Bold
  const parts = text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[.+?\]\(.+?\))/)
  return parts.map((part, i) => {
    const wiki = part.match(/^\[\[([^\]]+)\]\]$/)
    if (wiki) return <WikiLink key={i} title={wiki[1].trim()} />
    if (part.match(/^\*\*(.+)\*\*$/)) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.match(/^_(.+)_$/)) return <em key={i}>{part.slice(1, -1)}</em>
    if (part.match(/^`(.+)`$/)) return <code key={i} style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, fontSize: 13 }}>{part.slice(1, -1)}</code>
    const link = part.match(/^\[(.+?)\]\((.+?)\)$/)
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent-amber)', textDecoration: 'underline', textDecorationColor: 'rgba(var(--accent-rgb), 0.4)' }}>{link[1]}</a>
    return part
  })
}

type Sel = { start: number; end: number }

const todayText = () => new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
const nowText = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Prefixos de linha que os atalhos trocam entre si (tocar em "lista" numa tarefa vira lista) */
const LINE_PREFIX = /^(\s*)(- \[[ xX]\] |- |\d+\. |#{1,3} |> )?/

const PREFIXES: Record<string, string> = { task: '- [ ] ', list: '- ', numbered: '1. ', heading: '## ', subheading: '### ', quote: '> ' }

/** Linha que contém a posição `pos`: início, fim e texto */
function lineAt(v: string, pos: number) {
  const start = v.lastIndexOf('\n', pos - 1) + 1
  const endIdx = v.indexOf('\n', pos)
  const end = endIdx === -1 ? v.length : endIdx
  return { start, end, text: v.slice(start, end) }
}

export default function MarkdownEditor({ value, onChange, placeholder = 'Escreva aqui...', ref, onEditingChange, onDictate }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(false)
  const [wikilinkOpen, setWikilinkOpen] = useState(false)
  const [wikilinkQuery, setWikilinkQuery] = useState('')
  const [wikilinkCursorPos, setWikilinkCursorPos] = useState(0)
  /** "-" ou "/" digitado sozinho no começo da linha: a barra mostra as opções dele */
  const [trigger, setTrigger] = useState<'-' | '/' | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /** Último cursor conhecido: o ditado e os templates entram aqui mesmo depois de sair da edição */
  const selRef = useRef<Sel | null>(null)
  /** Cursor a aplicar quando o textarea montar ou o texto mudar */
  const pendingSel = useRef<number | null>(null)
  const valueRef = useRef(value)
  /** Cursor a usar no próximo comando no lugar do real (depois de tirar o "-" ou "/" do gatilho) */
  const selOverride = useRef<Sel | null>(null)
  useLayoutEffect(() => { valueRef.current = value }, [value])

  useEffect(() => { onEditingChange?.(isEditing) }, [isEditing, onEditingChange])

  // Altura acompanha o texto: o textarea nunca rola por dentro, quem rola é a página.
  // (Antes a altura vinha do número de linhas, e em notas longas com linhas quebradas o final sumia.)
  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    // Medir com height:auto encolhe a página por um instante, e o navegador puxa a rolagem
    // para cima — o ponto onde se escreve sumia da tela em notas longas. Guarda e devolve.
    const y = window.scrollY
    ta.style.height = 'auto'
    ta.style.height = `${Math.max(300, ta.scrollHeight)}px`
    if (window.scrollY !== y) window.scrollTo(0, y)
    if (pendingSel.current === null && document.activeElement === ta) {
      // Digitando: mantém a linha do cursor acima do teclado e da barra de atalhos
      scrollCaretIntoView(ta)
    }
    if (pendingSel.current !== null) {
      const pos = Math.min(pendingSel.current, ta.value.length)
      pendingSel.current = null
      ta.focus({ preventScroll: true })
      ta.setSelectionRange(pos, pos)
      selRef.current = { start: pos, end: pos }
      scrollCaretIntoView(ta)
    }
  }, [value, isEditing])

  /** Troca o texto e põe o cursor em `caret` */
  const commit = useCallback((next: string, caret: number) => {
    selOverride.current = null
    pendingSel.current = caret
    selRef.current = { start: caret, end: caret }
    valueRef.current = next
    onChange(next)
  }, [onChange])

  const currentSel = useCallback((): Sel => {
    if (selOverride.current) return selOverride.current
    const ta = textareaRef.current
    if (ta && document.activeElement === ta) return { start: ta.selectionStart, end: ta.selectionEnd }
    const v = valueRef.current
    const s = selRef.current
    return s ? { start: Math.min(s.start, v.length), end: Math.min(s.end, v.length) } : { start: v.length, end: v.length }
  }, [])

  /** Insere no cursor. `block` garante linha própria (com quebra antes e depois, se preciso). */
  const insert = useCallback((text: string, opts?: { block?: boolean }) => {
    const v = valueRef.current
    const { start, end } = currentSel()
    const before = v.slice(0, start)
    const after = v.slice(end)
    let piece = text
    if (opts?.block) {
      if (before && !before.endsWith('\n')) piece = '\n' + piece
      if (after && !after.startsWith('\n') && !piece.endsWith('\n')) piece = piece + '\n'
    } else {
      if (before && !/\s$/.test(before) && !/^[\s.,;:!?]/.test(piece)) piece = ' ' + piece
      if (after && !/^\s/.test(after) && !/\s$/.test(piece)) piece = piece + ' '
    }
    commit(before + piece + after, before.length + piece.length)
  }, [commit, currentSel])

  const done = useCallback(() => {
    textareaRef.current?.blur()
    setIsEditing(false)
    setTrigger(null)
    setToolbarVisible(false)
  }, [])

  const before = useCallback(() => valueRef.current.slice(0, currentSel().start), [currentSel])

  useImperativeHandle(ref, () => ({ insert, done, before }), [insert, done, before])

  const handleToggleTask = useCallback((lineIndex: number) => {
    const lines = value.split('\n')
    lines[lineIndex] = lines[lineIndex].replace(/^(\s*[-*]\s+\[)([ xX])\]/, (_, open: string, mark: string) => `${open}${mark === ' ' ? 'x' : ' '}]`)
    onChange(lines.join('\n'))
  }, [value, onChange])

  /** Troca o começo da linha do cursor (lista, tarefa, título...) mantendo o texto dela */
  const setLinePrefix = (prefix: string, replaceTrigger: boolean) => {
    const v = valueRef.current
    const line = lineAt(v, currentSel().start)
    const text = replaceTrigger ? line.text.replace(/^(\s*)[-/]\s*/, '$1') : line.text
    const m = text.match(LINE_PREFIX)!
    const indent = m[1] ?? ''
    const old = m[2] ?? ''
    // Tocar de novo no mesmo formato tira o formato
    const nextLine = indent + (old === prefix ? '' : prefix) + text.slice(indent.length + old.length)
    commit(v.slice(0, line.start) + nextLine + v.slice(line.end), line.start + nextLine.length)
  }

  const wrapSelection = (mark: string) => {
    const v = valueRef.current
    const { start, end } = currentSel()
    const sel = v.slice(start, end)
    if (sel) commit(v.slice(0, start) + mark + sel + mark + v.slice(end), end + mark.length * 2)
    else commit(v.slice(0, start) + mark + mark + v.slice(end), start + mark.length)
  }

  const pick = (id: string, fromTrigger: boolean) => {
    setTrigger(null)
    if (PREFIXES[id]) return setLinePrefix(PREFIXES[id], fromTrigger)

    if (fromTrigger) {
      // Os outros itens inserem algo: antes, tira o "-" ou "/" digitado na linha
      const v = valueRef.current
      const line = lineAt(v, currentSel().start)
      const text = line.text.replace(/^(\s*)[-/]\s*$/, '$1')
      const caret = line.start + text.length
      valueRef.current = v.slice(0, line.start) + text + v.slice(line.end)
      selOverride.current = { start: caret, end: caret }
    }
    switch (id) {
      case 'bold': return wrapSelection('**')
      case 'divider': return insert('---\n', { block: true })
      case 'today': return insert(todayText())
      case 'now': return insert(nowText())
      case 'link': {
        const v = valueRef.current
        const { start, end } = currentSel()
        const pre = start > 0 && !/\s/.test(v[start - 1]) ? ' ' : ''
        const caret = start + pre.length + 2
        commit(v.slice(0, start) + pre + '[[' + v.slice(end), caret)
        setWikilinkQuery('')
        setWikilinkCursorPos(caret)
        setWikilinkOpen(true)
        return
      }
    }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && trigger) { setTrigger(null); return }
    if (e.key !== 'Enter' || e.shiftKey) return
    const textarea = textareaRef.current
    if (!textarea || textarea.selectionStart !== textarea.selectionEnd) return
    const start = textarea.selectionStart
    const line = value.slice(value.lastIndexOf('\n', start - 1) + 1, start)

    // Item vazio + Enter = fim da lista (tira o marcador em vez de criar outro)
    if (/^\s*(- \[[ xX]\] |- |\d+\. )$/.test(line)) {
      e.preventDefault()
      commit(value.slice(0, start - line.length) + value.slice(start), start - line.length)
      return
    }
    const m = line.match(/^(\s*)(- \[[ xX]\] |- |(\d+)\. )/)
    if (!m) return
    e.preventDefault()
    const next = m[3] ? `${Number(m[3]) + 1}. ` : m[2].startsWith('- [') ? '- [ ] ' : '- '
    const piece = '\n' + m[1] + next
    commit(value.slice(0, start) + piece + value.slice(start), start + piece.length)
  }, [value, commit, trigger])

  const handleEditorChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursorPos = e.target.selectionStart
    selRef.current = { start: cursorPos, end: e.target.selectionEnd }
    valueRef.current = val
    onChange(val)

    const textBefore = val.slice(0, cursorPos)
    const lineBefore = textBefore.slice(textBefore.lastIndexOf('\n') + 1)
    setTrigger(/^\s*-$/.test(lineBefore) ? '-' : /^\s*\/$/.test(lineBefore) ? '/' : null)

    const match = textBefore.match(/\[\[([^\]]*)$/)
    if (match) {
      setWikilinkQuery(match[1])
      setWikilinkCursorPos(cursorPos)
      setWikilinkOpen(true)
    } else if (wikilinkOpen) {
      setWikilinkOpen(false)
      setWikilinkQuery('')
    }
  }, [onChange, wikilinkOpen])

  const handleWikilinkSelect = useCallback((title: string) => {
    const v = valueRef.current
    const openIdx = v.slice(0, wikilinkCursorPos).lastIndexOf('[[')
    if (openIdx !== -1) {
      // Fecha o link mesmo se já houver "]]" logo depois
      const rest = v.slice(wikilinkCursorPos).replace(/^[^\]\n]*\]\]/, '')
      setIsEditing(true)
      commit(v.slice(0, openIdx) + `[[${title}]]` + rest, openIdx + title.length + 4)
    }
    setWikilinkOpen(false)
    setWikilinkQuery('')
  }, [wikilinkCursorPos, commit])

  const handleSelect = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    selRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd }
    setToolbarVisible(textarea.selectionEnd - textarea.selectionStart > 0)
  }

  /** Abre a edição com o cursor no fim da linha tocada (e não no começo da nota) */
  const openAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest('[data-line]')
    const line = el ? Number(el.getAttribute('data-line')) : NaN
    pendingSel.current = Number.isFinite(line) ? value.split('\n').slice(0, line + 1).join('\n').length : value.length
    setIsEditing(true)
  }

  return (
    <div style={{ position: 'relative' }}>
      <WikilinkAutocomplete
        open={wikilinkOpen}
        query={wikilinkQuery}
        onSelect={handleWikilinkSelect}
        onClose={() => { setWikilinkOpen(false); setWikilinkQuery('') }}
      />
      {isEditing ? (
        <AmberCaret>
          <div style={{ position: 'relative' }}>
            <FloatingToolbar
              visible={toolbarVisible}
              onBold={() => { wrapSelection('**'); setToolbarVisible(false) }}
              onItalic={() => { wrapSelection('_'); setToolbarVisible(false) }}
              onCode={() => { wrapSelection('`'); setToolbarVisible(false) }}
            />
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleEditorChange}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onBlur={() => {
                // A lista de notas do [[ ]] abre por cima: escolher uma nota não encerra a edição
                if (wikilinkOpen || pendingSel.current !== null) return
                setIsEditing(false)
                setToolbarVisible(false)
                setTrigger(null)
              }}
              autoFocus
              placeholder={placeholder}
              className="amber-caret w-full"
              style={{
                display: 'block',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                overflow: 'hidden',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-serif)',
                fontSize: 17,
                lineHeight: '30px',
                padding: 0,
                minHeight: 300,
                caretColor: 'var(--accent-amber)',
              }}
            />
          </div>
          <EditorAccessory
            trigger={trigger}
            onPick={pick}
            onDismissTrigger={() => setTrigger(null)}
            onDictate={onDictate ? () => { done(); onDictate() } : undefined}
            onDone={done}
          />
        </AmberCaret>
      ) : (
        <div
          onClick={openAt}
          style={{ minHeight: 300, cursor: 'text' }}
        >
          {value ? (
            <div>{renderMarkdown(value, handleToggleTask)}</div>
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

/**
 * Rola a página até o cursor ficar visível acima do teclado e da barra de atalhos.
 * Mede a altura do texto antes do cursor com um "espelho" do textarea (mesma fonte e largura).
 */
function scrollCaretIntoView(ta: HTMLTextAreaElement) {
  const cs = getComputedStyle(ta)
  const mirror = document.createElement('div')
  Object.assign(mirror.style, {
    position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px',
    width: `${ta.clientWidth}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
    fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
  })
  mirror.textContent = ta.value.slice(0, ta.selectionStart) + '​'
  document.body.appendChild(mirror)
  const caretY = ta.getBoundingClientRect().top + mirror.scrollHeight
  mirror.remove()
  // No iPhone o teclado cobre a página: vale a parte visível (visualViewport), e não a janela
  const vv = window.visualViewport
  const viewTop = vv?.offsetTop ?? 0
  const viewH = vv?.height ?? window.innerHeight
  const bottomLimit = viewTop + viewH - 72 // barra de atalhos
  if (caretY > bottomLimit) window.scrollBy({ top: caretY - bottomLimit + 24 })
  else if (caretY < viewTop + 90) window.scrollBy({ top: caretY - viewTop - 120 })
}
