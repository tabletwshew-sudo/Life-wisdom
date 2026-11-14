import clsx from 'clsx'
import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
  hint?: ReactNode
}

export function Field({ label, error, hint, className, id, ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        {...rest}
        className={clsx(
          'min-h-12 w-full rounded-xl border bg-card px-4 text-ink placeholder:text-ink-3',
          'focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none dark:focus:ring-brand-700',
          error ? 'border-red-500' : 'border-line',
        )}
      />
      {error ? (
        <p id={`${inputId}-err`} role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
