/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// App shell: every built file is cached so the app opens offline.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

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

// Push notifications are added in Phase 5.
