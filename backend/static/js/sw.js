// Service Worker for Push Notifications
const CACHE_NAME = "cs-association-v1"
const urlsToCache = [
  "/",
  "/static/css/styles.css",
  "/static/js/scripts.js",
  "/static/images/icon-192x192.png",
  "/static/images/icon-512x512.png",
]

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    }),
  )
})

// Fetch event
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request)
    }),
  )
})

// Push event
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || "/static/images/icon-192x192.png",
      badge: data.badge || "/static/images/badge-72x72.png",
      data: data.data || {},
      actions: data.actions || [],
      dir: data.dir || "ltr",
      lang: data.lang || "en",
      requireInteraction: data.data && data.data.priority === "urgent",
      silent: false,
      tag: data.data ? `${data.data.type}-${data.data.announcement_id || data.data.event_id}` : "default",
      renotify: true,
      vibrate: data.data && data.data.priority === "urgent" ? [200, 100, 200] : [100, 50, 100],
    }

    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "dismiss") {
    return
  }

  const data = event.notification.data
  let url = "/"

  if (data && data.url) {
    url = data.url
  }

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus()
        }
      }

      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    }),
  )
})

// Background sync (for offline functionality)
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(doBackgroundSync())
  }
})

function doBackgroundSync() {
  // Implement background sync logic here
  return Promise.resolve()
}
