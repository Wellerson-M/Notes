// Service Worker — Grafite Notas
// Os dados vivem no IndexedDB; aqui só guardamos a "casca" do app para abrir sem internet.
//  - páginas: rede primeiro, cache como reserva (chave = caminho, sem query)
//  - payloads RSC: direto na rede; se falhar, o Next faz navegação completa e cai no item acima
//  - /_next/static: cache primeiro (arquivos com hash, nunca mudam)
//  - /api: nunca passa pelo cache

// Versão do deploy vem na URL de registro (/sw.js?v=...): deploy novo troca os caches
const VERSION = new URL(self.location.href).searchParams.get('v') ?? 'v2'
const SHELL = `grafite-shell-${VERSION}`
const STATIC = `grafite-static-${VERSION}`
const PAGES = ['/', '/note', '/journal', '/vault', '/search', '/settings', '/assistant']

self.addEventListener('install', (event) => {
  event.waitUntil(precache().finally(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== SHELL && k !== STATIC).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

/** Baixa as páginas e todos os chunks JS/CSS que elas referenciam */
async function precache() {
  const shell = await caches.open(SHELL)
  const statics = await caches.open(STATIC)
  const assets = new Set()
  await Promise.all(PAGES.map(async (path) => {
    try {
      const res = await fetch(path, { credentials: 'same-origin' })
      if (!res.ok) return
      const html = await res.clone().text()
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(m[0])
      await shell.put(cacheKey(new Request(path)), res)
    } catch { /* offline na instalação: tenta de novo na próxima */ }
  }))
  await Promise.all([...assets].map((url) => statics.add(url).catch(() => {})))
}

/** As páginas são estáticas: a query (?id=, ?mode=) não muda o HTML */
function cacheKey(request) {
  const url = new URL(request.url)
  return `${url.origin}${url.pathname}`
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (request.headers.get('RSC') === '1') return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  // Ícones, manifest, fontes: devolve o cache e atualiza em segundo plano
  event.respondWith(staleWhileRevalidate(request))
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL)
  const key = cacheKey(request)
  try {
    const res = await fetch(request)
    if (res.ok && !res.redirected) cache.put(key, res.clone())
    return res
  } catch {
    const hit = await cache.match(key)
    if (hit) return hit
    const home = await cache.match(cacheKey(new Request('/')))
    if (home) return home
    return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(request)
  const network = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res })
    .catch(() => hit ?? Response.error())
  return hit ?? network
}

// ── Lembretes (Web Push) ────────────────────────────────────────────────
// O servidor manda { title, body, url, tag }; o relógio (Zepp etc.) espelha a notificação do celular.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() } }
  const title = data.title || 'Grafite Notas'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || 'lembrete',
    renotify: true,
    requireInteraction: false,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    vibrate: [180, 80, 180],
    timestamp: Date.now(),
    data: { url: data.url || '/', title, body: data.body || '', tag: data.tag || 'lembrete' },
    actions: data.tag === 'teste' ? [] : [{ action: 'snooze', title: 'Adiar 10 min' }, { action: 'open', title: 'Abrir' }],
  }))
})

self.addEventListener('notificationclick', (event) => {
  const n = event.notification
  const data = n.data || {}
  n.close()
  if (event.action === 'snooze') {
    event.waitUntil(fetch('/api/push/snooze', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: data.title, body: data.body, url: data.url, tag: data.tag, minutes: 10 }),
    }).catch(() => {}))
    return
  }
  event.waitUntil((async () => {
    const target = new URL(data.url || '/', self.location.origin).href
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const win = wins.find((w) => w.url.startsWith(self.location.origin))
    if (win) {
      await win.focus()
      if ('navigate' in win) return win.navigate(target).catch(() => self.clients.openWindow(target))
    }
    return self.clients.openWindow(target)
  })())
})
