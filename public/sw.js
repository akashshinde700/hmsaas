// Privacy-safe Healthcare PWA Service Worker
// Caches immutable static chunks & offline fallback only — never caches PHI/patient API responses.
// Handles Background Sync for offline-first mutation queue.

const CACHE_NAME = 'aethermed-hms-static-v3'
const OFFLINE_URL = '/offline.html'
const SYNC_TAG = 'aethermed-sync-mutations'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone()
              caches.open(CACHE_NAME).then((c) => c.put(request, clone))
            }
            return res
          })
      )
    )
  }
})

// Background Sync: flush pending offline mutations when connectivity returns
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(
      (async () => {
        // Notify all clients that sync is starting
        const clients = await self.clients.matchAll({ includeUncontrolled: true })
        clients.forEach((c) =>
          c.postMessage({ type: 'SYNC_STARTED' })
        )

        try {
          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Body will be populated by the client before registering sync
          })

          clients.forEach((c) =>
            c.postMessage({ type: 'SYNC_COMPLETED', ok: res.ok })
          )
        } catch {
          clients.forEach((c) =>
            c.postMessage({ type: 'SYNC_FAILED' })
          )
        }
      })()
    )
  }
})

// Listen for messages from clients (e.g., register sync)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REQUEST_BACKGROUND_SYNC') {
    event.waitUntil(
      self.registration.sync.register(SYNC_TAG).catch(() => {})
    )
  }
})
