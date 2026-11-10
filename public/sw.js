const BUILD = __BUILD__
const CACHE_NAME = `miholens-${BUILD.id}`

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(BUILD.urls)))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    void self.skipWaiting()
  }
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return
  }
  event.respondWith(
    caches
      .match(event.request, { cacheName: CACHE_NAME, ignoreVary: true })
      .then((cached) => cached ?? fetch(event.request)),
  )
})
