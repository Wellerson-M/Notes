const KEY = 'grafite-recent-searches'
const MAX = 6

export function loadRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function saveRecentSearch(query: string) {
  const q = query.trim()
  if (!q) return
  try {
    const next = [q, ...loadRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* armazenamento indisponível: sem histórico */ }
}

export function clearRecentSearches() {
  try { localStorage.removeItem(KEY) } catch { /* nada a limpar */ }
}
