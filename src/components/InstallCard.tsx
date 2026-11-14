import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { isIOS, isStandalone, useInstallPrompt } from '@/hooks/useInstall'

const DISMISS_KEY = 'fh-install-dismissed'

/** A small card on the Today page nudging people to install the app. */
export function InstallCard() {
  const { available, install } = useInstallPrompt()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  if (hidden || isStandalone() || (!isIOS() && !available)) return null
  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  return (
    <Card className="relative mb-4 flex items-center gap-3 border-2 border-brand-200 p-4 dark:border-brand-700">
      <img src="/logo.svg" alt="" className="size-12 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Install Family Hub</p>
        <p className="text-sm text-ink-3">
          {isIOS() ? 'Add it to your Home Screen for a full-screen app and notifications.' : 'Install it like an app on this device.'}
        </p>
      </div>
      {isIOS() ? (
        <Link to="/more/install" className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">
          How?
        </Link>
      ) : (
        <Button size="md" onClick={install} icon={<Download className="size-4" />}>
          Install
        </Button>
      )}
      <button onClick={dismiss} aria-label="Hide install tip" className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-card-2 shadow">
        <X className="size-4" aria-hidden />
      </button>
    </Card>
  )
}

