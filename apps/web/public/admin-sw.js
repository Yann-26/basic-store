/*
 * Back-office app (PWA) service worker — scope /admin.
 * Deliberately minimal: pages and data always come from the network (orders,
 * stock and payments must never be stale, and nothing private is cached).
 * When the network is down, a page navigation shows an offline screen instead
 * of the browser's error page.
 */
const CACHE = 'trs-admin-v1'
const OFFLINE_URL = '/app/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return // assets and /api/* go straight to the network
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
  )
})
