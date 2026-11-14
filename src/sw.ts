/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// App shell: every built file is cached so the app opens offline.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Take control of open pages on first install (so notification taps can steer them).
clientsClaim()

// Single-page app: all page navigations get index.html (offline too).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))

// iOS splash screens: cached on first use.
registerRoute(
  ({ url }) => url.pathname.startsWith('/apple-splash-'),
  new CacheFirst({ cacheName: 'splash', plugins: [new ExpirationPlugin({ maxEntries: 60 })] }),
)

// The page asks us to activate a new version when the user taps "Update".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})


// ---------------------------------------------------------------------------
// Push notifications (Phase 5)
// ---------------------------------------------------------------------------
interface PushData {
  title?: string
  body?: string
  url?: string
  tag?: string
  badge?: number
}

self.addEventListener('push', (event) => {
  let data: PushData = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'Family Hub', body: event.data?.text() }
  }
  const nav = self.navigator as WorkerNavigator & { setAppBadge?: (n: number) => Promise<void> }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Family Hub', {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: data.tag,
        data: { url: data.url || '/' },
      }),
      data.badge ? nav.setAppBadge?.(data.badge).catch(() => {}) : Promise.resolve(),
    ]),
  )
})

// Tapping a notification opens (or focuses) the app on the right page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = (event.notification.data as { url?: string } | null)?.url || '/'
  const target = new URL(path.startsWith('/') ? path : '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          // The app moves itself to the page (works even if this tab isn't controlled yet).
          w.postMessage({ type: 'navigate', url: path })
          await w.focus().catch(() => {})
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
