'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Image, Mic, Hash, LayoutTemplate, Sparkles } from 'lucide-react'

const TEMPLATES = [
  { id: 'meeting', label: 'Reunião', icon: '📋', content: '## Reunião — {data}\n\n**Participantes:**\n\n**Pauta:**\n\n**Decisões:**\n\n**Próximos passos:**\n- [ ] ' },
  { id: 'book', label: 'Fichamento', icon: '📖', content: '# {título} — {autor}\n\n## Resumo\n\n## Citações\n\n> \n\n## O que aprendi\n\n## Para aplicar\n' },
  { id: 'brainstorm', label: 'Brainstorm', icon: '💡', content: '## Brainstorm — {tema}\n\n**Problema:**\n\n**Ideias (sem filtro):**\n- \n- \n- \n\n**Melhores ideias:**\n\n**Próximos passos:**\n' },
  { id: 'diary', label: 'Diário', icon: '📔', content: '## {data}\n\n**Mood:** \n\n**O que aconteceu:**\n\n**Gratidão:**\n- \n\n**Amanhã quero:**\n' },
  { id: 'shopping', label: 'Lista de compras', icon: '🛒', content: '## Lista de compras\n\n- [ ] \n- [ ] \n- [ ] \n' },
  { id: 'recipe', label: 'Receita', icon: '🍳', content: '# {nome da receita}\n\n**Porções:** \n**Tempo:** \n\n**Ingredientes:**\n- \n\n**Modo de preparo:**\n1. \n' },
]

const AI_ACTIONS = [
  { id: 'summarize', label: 'Resumir', desc: 'Condensa o texto mantendo os pontos principais' },
  { id: 'tasks', label: 'Virar tarefas', desc: 'Extrai ações e cria uma lista de tarefas' },
  { id: 'expand', label: 'Expandir', desc: 'Desenvolve as ideias com mais detalhes' },
  { id: 'translate', label: 'Traduzir', desc: 'Traduz para inglês ou outro idioma' },
  { id: 'fix', label: 'Corrigir português', desc: 'Corrige gramática e ortografia' },
  { id: 'topics', label: 'Transformar em tópicos', desc: 'Reestrutura como lista de tópicos' },
]

interface Props {
  onInsertTemplate?: (content: string) => void
  onStartAudio?: () => void
  onAddPhoto?: () => void
}

export default function BottomToolbar({ onInsertTemplate, onStartAudio, onAddPhoto }: Props) {
  const [sheet, setSheet] = useState<'template' | 'ai' | null>(null)

  const handleTemplate = (content: string) => {
    onInsertTemplate?.(content)
    setSheet(null)
  }

  const handleAIAction = (id: string) => {
    // TODO: integrar com IA real
    setTimeout(() => {
      setSheet(null)
    }, 300)
  }

  return (
    <>
      <div
        className="flex items-center justify-around px-4"
        style={{
          height: 48,
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
        }}
      >
        {[
          { Icon: CheckSquare, label: 'tarefa', onClick: () => onInsertTemplate?.('- [ ] ') },
          { Icon: Image, label: 'foto', onClick: onAddPhoto },
          { Icon: Mic, label: 'áudio', onClick: onStartAudio },
          { Icon: Hash, label: 'tag', onClick: () => onInsertTemplate?.('#') },
          { Icon: LayoutTemplate, label: 'template', onClick: () => setSheet('template') },
          { Icon: Sparkles, label: 'IA', onClick: () => setSheet('ai'), amber: true },
        ].map(({ Icon, label, onClick, amber }) => (
          <button
            key={label}
            onClick={onClick}
            className="touch-feedback flex flex-col items-center gap-0.5 py-1 px-2"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Icon
              size={18}
              style={{ color: amber ? 'var(--accent-amber)' : 'var(--text-muted)' }}
            />
            <span style={{ fontSize: 9, color: amber ? 'var(--accent-amber)' : 'var(--text-muted)', fontWeight: 500 }}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom sheet — Template */}
      <AnimatePresence>
        {sheet === 'template' && (
          <BottomSheet title="Inserir template" onClose={() => setSheet(null)}>
            <div className="flex flex-col gap-1 p-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTemplate(t.content)}
                  className="touch-feedback flex items-center gap-3 rounded-xl px-4 py-3 text-left"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                >
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </BottomSheet>
        )}

        {sheet === 'ai' && (
          <BottomSheet title="Ações de IA" onClose={() => setSheet(null)}>
            <div className="flex flex-col gap-1 p-4">
              {AI_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAIAction(a.id)}
                  className="touch-feedback flex items-start gap-3 rounded-xl px-4 py-3 text-left"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                >
                  <Sparkles size={16} style={{ color: 'var(--accent-amber)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>{a.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </>
  )
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
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
