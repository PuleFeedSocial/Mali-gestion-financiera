const CACHE = 'mali-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style/style.css',
  '/script/auth.js',
  '/icons/icon.svg',
  '/icons/icon-192.svg',
  '/pages/acceder-formulario.html',
  '/pages/dashboard.html'
]

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  if (url.origin !== location.origin) return

  if (url.pathname.startsWith('/supabase/') || url.pathname.startsWith('https://')) {
    e.respondWith(fetch(e.request))
    return
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      }).catch(() => cached)
      return cached || fetchPromise
    })
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', (e) => {
  if (!e.data) return
  try {
    const data = e.data.json()
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      actions: data.actions || []
    }
    e.waitUntil(
      self.registration.showNotification(data.title || 'Mali', options)
    )
  } catch (_) {}
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
