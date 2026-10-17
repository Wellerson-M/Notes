/**
 * Links da web dentro das notas: `[texto](endereço)` e endereços soltos (`https://…`, `www.…`).
 * Só http(s), e-mail e telefone viram link clicável — nada de `javascript:` vindo de texto colado.
 */

/** Endereço solto no texto (sem a pontuação que costuma vir colada no fim da frase) */
export const BARE_URL = /(?:https?:\/\/|www\.)[^\s<>()[\]]*[^\s<>()[\].,;:!?'"]/

/** Completa e valida o endereço digitado. `null` = não é um endereço aceitável */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s || /\s/.test(s)) return null
  if (/^(mailto:|tel:)/i.test(s)) return s
  if (/^[^@\s/]+@[^@\s/]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    // "site" sozinho não é endereço; "site.com", "localhost:3000" e IPs são
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return withScheme
  } catch {
    return null
  }
}

/** Endereço que pode ir num href (o resto vira texto comum) */
export function safeHref(raw: string): string | null {
  const s = raw.trim()
  if (/^(mailto:|tel:)/i.test(s)) return s
  if (/^www\./i.test(s)) return `https://${s}`
  return /^https?:\/\//i.test(s) ? s : null
}

/** Nome curto para mostrar um endereço solto: "site.com.br/caminho…" */
export function shortUrl(url: string): string {
  const s = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  return s.length > 42 ? `${s.slice(0, 41)}…` : s
}
