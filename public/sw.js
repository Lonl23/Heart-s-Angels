/* Heart's Angels — service worker (installabilité PWA, cache d'enveloppe).
   CACHE_NAME est tamponné à chaque build (voir vite.config.js) pour que le
   navigateur détecte un nouveau sw.js après un déploiement Firebase.
   skipWaiting n'est PAS appelé à l'install : la page envoie SKIP_WAITING
   seulement quand l'utilisateur confirme « Mettre à jour ».
   Manifest, icônes et favicon passent toujours par le réseau (jamais le cache). */
const CACHE_NAME = 'ha-app-v4-__SW_BUILD__'
const PRECACHE = ['/index.html']

function isVolatile(pathname) {
  return (
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/apple-touch-icon') ||
    pathname.startsWith('/ha-logo-') ||
    pathname.startsWith('/favicon')
  )
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (isVolatile(url.pathname)) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then(c => c.put('/index.html', copy)).catch(() => {})
        return res
      }).catch(() => caches.match('/index.html'))
    )
    return
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)))
})
