import { Download, Share, SquarePlus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { isIOS, isIOSSafari, isStandalone, useInstallPrompt } from '@/hooks/useInstall'

export default function InstallHelp() {
  const { available, install } = useInstallPrompt()
  const standalone = isStandalone()
  return (
    <>
      <PageHeader title="Install the app" />
      {standalone ? (
        <Card className="p-5">
          <p className="text-lg font-bold">✅ You’re using the installed app.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-bold">On iPhone or iPad</h2>
            {isIOS() && !isIOSSafari() && (
              <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                Tip: open this page in <strong>Safari</strong> for the most reliable install.
              </p>
            )}
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                Tap the <strong>Share</strong> button <Share className="inline size-5 text-brand-500" aria-label="Share icon" /> at the bottom (or top) of Safari.
              </Step>
              <Step n={2}>
                Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus className="inline size-5 text-brand-500" aria-label="Add icon" />.
              </Step>
              <Step n={3}>
                Tap <strong>Add</strong>. Open Family Hub from its new icon on your Home Screen.
              </Step>
            </ol>
          </Card>
          <Card className="p-5">
            <h2 className="mb-2 text-lg font-bold">On Android, Windows or Mac</h2>
            <p className="text-ink-2">In Chrome or Edge, look for the install icon in the address bar, or use the button below.</p>
            {available && (
              <Button className="mt-3" onClick={install} icon={<Download className="size-5" />}>
                Install Family Hub
              </Button>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-2 text-lg font-bold">Just using a browser?</h2>
            <p className="text-ink-2">That’s fine too — everything works in a normal browser tab. Installing just gives you an app icon, full-screen view and (on iPhone) push notifications.</p>
          </Card>
        </div>
      )}
    </>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold text-white" aria-hidden>
        {n}
      </span>
      <span className="pt-1 text-ink-2">{children}</span>
    </li>
  )
}
