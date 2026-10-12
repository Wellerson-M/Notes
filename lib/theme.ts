/**
 * Temas: cada um é um bloco `[data-theme="<id>"]` em app/globals.css que redefine os tokens de cor.
 * A escolha fica no aparelho (localStorage) e é aplicada por um script no <head> antes da
 * primeira pintura — assim o app não pisca no tema padrão ao abrir.
 */

export type ThemeId = 'grafite' | 'meia-noite' | 'floresta' | 'vinho' | 'lavanda' | 'papel' | 'neblina'

export type Theme = {
  id: ThemeId
  name: string
  description: string
  /** Cor da barra do sistema (meta theme-color) — igual ao fundo */
  bar: string
  /** Prévia no seletor: fundo, superfície e destaque */
  swatch: [string, string, string]
  light?: boolean
}

export const THEMES: Theme[] = [
  { id: 'grafite', name: 'Grafite', description: 'âmbar sobre grafite quente', bar: '#111210', swatch: ['#111210', '#22231f', '#e8a547'] },
  { id: 'meia-noite', name: 'Meia-noite', description: 'azul calmo, noite funda', bar: '#0e1118', swatch: ['#0e1118', '#1c2130', '#7aa2f7'] },
  { id: 'floresta', name: 'Floresta', description: 'verde musgo e sálvia', bar: '#0f1310', swatch: ['#0f1310', '#1d241e', '#8fbf7f'] },
  { id: 'vinho', name: 'Vinho', description: 'bordô escuro e rosé', bar: '#140f10', swatch: ['#140f10', '#261b1d', '#e07a8c'] },
  { id: 'lavanda', name: 'Lavanda', description: 'roxo suave, quase cinza', bar: '#121017', swatch: ['#121017', '#221f2b', '#b39ddb'] },
  { id: 'papel', name: 'Papel', description: 'claro, como um caderno', bar: '#f4efe4', swatch: ['#f4efe4', '#fffbf2', '#b5651d'], light: true },
  { id: 'neblina', name: 'Neblina', description: 'claro e frio, azul-ardósia', bar: '#eef1f4', swatch: ['#eef1f4', '#ffffff', '#3b6ea5'], light: true },
]

export const DEFAULT_THEME: ThemeId = 'grafite'
const KEY = 'grafite-theme'

export function getTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(KEY) as ThemeId | null
    return saved && THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(id: ThemeId) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0]
  document.documentElement.dataset.theme = theme.id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bar)
  try { localStorage.setItem(KEY, theme.id) } catch { /* modo privado */ }
}

/** Script do <head>: aplica o tema salvo antes da primeira pintura (precisa ser autossuficiente) */
export const THEME_BOOT_SCRIPT = `
try {
  var bars = ${JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.id, t.bar])))};
  var t = localStorage.getItem('${KEY}');
  if (t && bars[t]) {
    document.documentElement.dataset.theme = t;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', bars[t]);
  }
} catch (e) {}
`
