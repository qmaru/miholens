export function registerServiceWorker(onUpdateReady: () => void) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return
  }

  void navigator.serviceWorker.register("/sw.js").then((registration) => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      onUpdateReady()
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          onUpdateReady()
        }
      })
    })

    if (navigator.onLine) {
      void registration.update()
    }
  })
}

export function applyServiceWorkerUpdate() {
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      location.reload()
    },
    { once: true },
  )
  void navigator.serviceWorker.getRegistration().then((registration) => {
    registration?.waiting?.postMessage("SKIP_WAITING")
  })
}
