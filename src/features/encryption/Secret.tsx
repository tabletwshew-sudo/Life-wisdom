import { Lock } from 'lucide-react'
import type { SecretField } from '@/lib/crypto/e2ee'
import { useSecret } from './EncryptionProvider'

/** Shows a (possibly encrypted) text field, or a lock if this device can't read it yet. */
export function Secret({ field, value, className }: { field: SecretField; value: string | null | undefined; className?: string }) {
  const { text, locked } = useSecret(field, value)
  if (locked)
    return (
      <span className={`inline-flex items-center gap-1 text-ink-3 ${className ?? ''}`}>
        <Lock className="size-4" aria-hidden /> Encrypted — unlock to read
      </span>
    )
  return <span className={className}>{text}</span>
}
