const BUILD = __BUILD__
const FONTS = __FONTS__
const CACHE_NAME = `miholens-${BUILD.id}`
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"]

async function precacheFonts() {
  const cache = await caches.open(FONTS.cache)
  const response = await fetch(FONTS.stylesheet)
  if (!response.ok) return
  await cache.put(FONTS.stylesheet, response.clone())
  const css = await response.text()
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((match) => match[1]))]
  await Promise.allSettled(
    urls.map(async (url) => {
      if (!(await cache.match(url))) await cache.add(url)
    }),
  )
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(BUILD.urls)),
      precacheFonts().catch(() => {}),
    ]),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== FONTS.cache)
            .map((key) => caches.delete(key)),
        ),
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
  if (event.request.method !== "GET") {
    return
  }
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(FONTS.cache).then((cache) =>
        cache.match(event.request, { ignoreVary: true }).then(
          (cached) =>
            cached ??
            fetch(event.request).then((response) => {
              if (response.ok || response.type === "opaque") {
                void cache.put(event.request, response.clone())
              }
              return response
            }),
        ),
      ),
    )
    return
  }
  if (url.origin !== self.location.origin) {
    return
  }
  event.respondWith(
    caches
      .match(event.request, { cacheName: CACHE_NAME, ignoreVary: true })
      .then((cached) => cached ?? fetch(event.request)),
  )
})
