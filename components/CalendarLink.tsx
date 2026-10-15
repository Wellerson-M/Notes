'use client'
import { useState } from 'react'
import { CalendarPlus, Copy } from 'lucide-react'
import { useUIStore } from '@/store/ui'

type Links = { feed: string; webcal: string; google: string }

/**
 * Liga a Agenda do app à agenda do celular por assinatura: o Google Agenda lê o feed .ics de
 * tempos em tempos, e a Agenda Samsung mostra os calendários da conta Google do aparelho.
 */
export default function CalendarLink({ connected }: { connected: boolean }) {
  const [links, setLinks] = useState<Links | null>(null)
  const [busy, setBusy] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  const load = async (): Promise<Links | null> => {
    if (links) return links
    setBusy(true)
    const res = await fetch('/api/agenda/link').catch(() => null)
    setBusy(false)
    if (!res?.ok) { showToast('Não deu para gerar o link agora'); return null }
    const data = (await res.json()) as Links
    setLinks(data)
    return data
  }

  if (!connected) {
    return <p className="px-5 py-3 font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Entre com a senha (em Sincronização) para ligar à agenda do celular.</p>
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '19px' }}>
        Tudo que tiver data aparece no Google Agenda — e, por ele, na <strong>Agenda Samsung</strong>. É só ver e lembrar: editar continua sendo aqui no app.
      </p>
      <button
        onClick={async () => { const l = await load(); if (l) window.open(l.google, '_blank') }}
        disabled={busy}
        className="touch-feedback flex items-center justify-center gap-2 rounded-xl py-3 font-sans"
        style={{ background: 'var(--accent-amber)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
      >
        <CalendarPlus size={16} /> {busy ? 'gerando...' : 'Adicionar ao Google Agenda'}
      </button>
      <button
        onClick={async () => {
          const l = await load()
          if (!l) return
          try { await navigator.clipboard.writeText(l.feed); showToast('Link copiado') } catch { showToast(l.feed) }
        }}
        className="touch-feedback flex items-center justify-center gap-2 rounded-xl py-2.5 font-sans"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 13, border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
      >
        <Copy size={14} /> Copiar link (outros apps de agenda)
      </button>
      <ol className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '18px', paddingLeft: 16, listStyle: 'decimal' }}>
        <li>Faça isto <strong>no computador</strong> (o app do Google Agenda no celular não assina por link): abra o app aqui no PC e toque no botão acima, ou copie o link e, em calendar.google.com, vá em “Outras agendas” → “+” → “Do URL”.</li>
        <li>No celular, no app Google Agenda: Configurações → “Grafite Notas” (ou “Notas”, se assinou antes) → ative “Sincronizar”.</li>
        <li>Na Agenda Samsung: menu ☰ → engrenagem/“Gerenciar agendas” → na conta Google, ative “Grafite Notas” (ou “Notas”).</li>
        <li>Para ser avisado: no site do Google Agenda, nas configurações da agenda “Grafite Notas” (ou “Notas”), defina as notificações de evento (ex.: 15 min antes).</li>
        <li>O Google relê a assinatura no tempo dele (pode levar até um dia). Para levar um evento na hora, use “Agenda do celular” dentro da nota.</li>
      </ol>
      <p className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: '16px' }}>
        O link é secreto: quem tiver ele vê os títulos e textos das notas com data (o Vault nunca entra). Trocar a senha do app invalida o link.
      </p>
    </div>
  )
}
