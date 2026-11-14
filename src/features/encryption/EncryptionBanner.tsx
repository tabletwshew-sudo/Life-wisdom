import { Hourglass, Lock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEncryption } from './EncryptionProvider'
import { UnlockSheet } from './UnlockSheet'

/** A slim banner when private notes can't be read on this device yet. */
export function EncryptionBanner() {
  const { status } = useEncryption()
  const [open, setOpen] = useState(false)
  if (status === 'needs-unlock')
    return (
      <>
        <div role="status" className="flex items-center justify-center gap-2 bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700 dark:bg-brand-700/40 dark:text-brand-100">
          <Lock className="size-4" aria-hidden /> Private notes are locked on this device.
          <button onClick={() => setOpen(true)} className="min-h-9 rounded-full bg-brand-500 px-3 text-white">
            Unlock
          </button>
        </div>
        <UnlockSheet open={open} onClose={() => setOpen(false)} />
      </>
    )
  if (status === 'waiting')
    return (
      <Link to="/more/encryption" role="status" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
        <Hourglass className="size-4" aria-hidden /> Waiting for an admin to share the family key — private notes appear once they open Family Hub.
      </Link>
    )
  return null
}
