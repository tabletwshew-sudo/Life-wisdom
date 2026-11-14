import clsx from 'clsx'
import { useId } from 'react'

interface Props {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

export function Toggle({ label, description, checked, onChange, disabled }: Props) {
  const id = useId()
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block font-medium">
          {label}
        </label>
        {description && <p className="text-sm text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-8 w-13 shrink-0 rounded-full transition disabled:opacity-50',
          checked ? 'bg-done' : 'bg-line',
        )}
      >
        <span
          className={clsx(
            'absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}
