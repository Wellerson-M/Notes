// Service Worker — Grafite Notas
// Cache strategy será implementada na fase de integração
// TODO: implementar cache offline com Workbox

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Pass-through por enquanto — sem cache strategy real
})
