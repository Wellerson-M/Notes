'use client'
import { useUIStore } from '@/store/ui'

/**
 * Atualização automática do app instalado.
 * Um PWA aberto continua rodando o código antigo até recarregar; aqui detectamos deploy novo
 * comparando a versão embutida no build com a de /api/version.
 *  - achou atualização logo ao abrir/voltar para o app (antes de você mexer) → recarrega na hora
 *  - achou com você usando → toast "atualizar", e recarrega sozinho na próxima vez que voltar ao app
 */

export const APP_VERSION = process.env.APP_VERSION ?? 'dev'
export const APP_BUILT_AT = process.env.APP_BUILT_AT

/** Evento que pede ao editor para gravar o que estiver pendente antes de recarregar */
export const FLUSH_EVENT = 'grafite:flush'

const JUST_UPDATED = 'grafite-just-updated'
const QUIET_WINDOW_MS = 2500

let updateReady = false
let lastInteraction = 0
let resumedAt = Date.now()

export async function checkForUpdate(): Promise<boolean> {
  if (APP_VERSION === 'dev' || !navigator.onLine) return false
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    const { version } = (await res.json()) as { version?: string }
    return !!version && version !== APP_VERSION
  } catch {
    return false
  }
}

export async function applyUpdate() {
  // Dá tempo para o editor gravar no IndexedDB antes da página sumir
  window.dispatchEvent(new Event(FLUSH_EVENT))
  await new Promise((r) => setTimeout(r, 700))
  try { sessionStorage.setItem(JUST_UPDATED, '1') } catch { /* sem sessionStorage: só não mostra o aviso */ }
  const reg = await navigator.serviceWorker?.getRegistration()
  await reg?.update().catch(() => {})
  window.location.reload()
}

async function check() {
  if (updateReady || !(await checkForUpdate())) return
  updateReady = true
  const untouched = lastInteraction < resumedAt && Date.now() - resumedAt < QUIET_WINDOW_MS
  if (untouched) {
    void applyUpdate()
  } else {
    useUIStore.getState().showToast('Nova versão disponível', {
      actionLabel: 'atualizar',
      onAction: () => void applyUpdate(),
      persistent: true,
    })
  }
}

export function startUpdateWatcher() {
  try {
    if (sessionStorage.getItem(JUST_UPDATED)) {
      sessionStorage.removeItem(JUST_UPDATED)
      useUIStore.getState().showToast('App atualizado ✓')
    }
  } catch { /* sem sessionStorage */ }

  const onInteract = () => { lastInteraction = Date.now() }
  const onVisibility = () => {
    if (document.visibilityState !== 'visible') return
    resumedAt = Date.now()
    if (updateReady) void applyUpdate() // você saiu e voltou: é a hora certa
    else void check()
  }

  window.addEventListener('pointerdown', onInteract, { passive: true })
  window.addEventListener('keydown', onInteract)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', check)
  const interval = setInterval(check, 15 * 60 * 1000)
  void check()

  return () => {
    window.removeEventListener('pointerdown', onInteract)
    window.removeEventListener('keydown', onInteract)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('online', check)
    clearInterval(interval)
  }
}
