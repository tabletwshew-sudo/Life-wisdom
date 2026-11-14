import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Registers the service worker and offers a reload when a new version is deployed. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Register right away (the page 'load' event has usually already fired).
    immediate: true,
    onRegisteredSW(_url, reg) {
      // Check for a new version every hour while the app is open.
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })
  if (!needRefresh) return null
  return (
    <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-brand-500 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-sm font-semibold text-white">
      A new version of Family Hub is ready.
      <button onClick={() => updateServiceWorker(true)} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/20 px-3">
        <RefreshCw className="size-4" aria-hidden /> Update
      </button>
      <button onClick={() => setNeedRefresh(false)} className="min-h-9 px-2 underline">
        Later
      </button>
    </div>
  )
}
