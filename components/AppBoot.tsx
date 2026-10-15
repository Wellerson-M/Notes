'use client'
import { useEffect } from 'react'
import { db, getMeta, setMeta } from '@/lib/db'
import { extractTasks } from '@/lib/notes'
import { scheduleSync, startAutoSync, syncNow } from '@/lib/sync'
import { startUpdateWatcher } from '@/lib/updates'
import { startAutoLock } from '@/lib/vault'
import { applyTheme, getTheme } from '@/lib/theme'
import { backupReminderDue } from '@/lib/backup'
import { useUIStore } from '@/store/ui'

const WELCOME_DATE = '2026-01-01T12:00:00.000Z'

const WELCOME = `Este app guarda tudo **no seu aparelho** primeiro, então funciona sem internet. Quando tiver conexão, sincroniza com a nuvem.

## Primeiros passos
- [ ] Entrar com a senha em Ajustes → Sincronização (para usar a nuvem e a IA)
- [ ] Tocar no ✨ lá em cima e falar com o assistente
- [ ] Segurar o botão + para ditar uma nota
- [ ] Apagar esta nota (arraste o card para a esquerda)

## Dicas
- Escreva \`[[\` para ligar uma nota a outra.
- No editor, o botão **IA** resume, corrige, organiza e dá sugestões.
- Puxe a lista para baixo para sincronizar na hora.`

/** Efeitos globais do app — montado uma vez no layout */
export default function AppBoot() {
  useEffect(() => {
    applyTheme(getTheme()) // garante a cor da barra do sistema (theme-color) no tema salvo
    const stopSync = startAutoSync()
    const stopUpdates = startUpdateWatcher()
    const stopAutoLock = startAutoLock()

    // Nota de boas-vindas num aparelho vazio. Id fixo + data antiga: entre aparelhos ela vira
    // uma nota só, e qualquer edição ou exclusão sua sempre vence esta cópia no sync.
    void (async () => {
      if (await getMeta('welcomed')) return
      await syncNow()
      if ((await db.notes.count()) === 0) {
        await db.notes.put({
          id: 'bem-vindo',
          title: 'Bem-vindo ao Grafite Notas',
          content: WELCOME,
          tags: ['começo'],
          pinned: true,
          inVault: false,
          attachments: {},
          tasks: extractTasks(WELCOME),
          createdAt: WELCOME_DATE,
          updatedAt: WELCOME_DATE,
          dirty: 1,
        })
        scheduleSync()
      }
      await setMeta('welcomed', 1)
    })()

    // Lembrete de backup em arquivo (fora do Atlas), sem atrapalhar a abertura do app
    const backupTimer = setTimeout(async () => {
      const days = await backupReminderDue().catch(() => null)
      if (days === null) return
      useUIStore.getState().showToast(
        days < 0 ? 'Você ainda não fez um backup das notas fora da nuvem' : `Faz ${days} dias do último backup das notas`,
        { actionLabel: 'fazer', onAction: () => { location.href = '/settings#backup' } },
      )
    }, 20_000)

    return () => { stopSync(); stopUpdates(); stopAutoLock(); clearTimeout(backupTimer) }
  }, [])

  return null
}
