/**
 * Rotas de nota usam query string (`/note?id=`) em vez de `/note/[id]`: assim a página é
 * estática e o service worker consegue abrir offline qualquer nota, mesmo nunca visitada.
 */
export const noteHref = (id: string) => `/note?id=${encodeURIComponent(id)}`
export const newNoteHref = (mode?: string) => (mode ? `/note?mode=${mode}` : '/note?mode=text')
