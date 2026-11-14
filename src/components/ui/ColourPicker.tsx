import clsx from 'clsx'
import { Check } from 'lucide-react'
import { PALETTE, readableTextOn } from '@/lib/colours'

interface Props {
  value: string
  onChange: (hex: string) => void
  /** Colours already used by other family members (shown, but marked). */
  taken?: string[]
  label?: string
}

export function ColourPicker({ value, onChange, taken = [], label = 'Colour' }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink-2">{label}</legend>
      <div className="grid grid-cols-5 gap-3">
        {PALETTE.map((c) => {
          const selected = c.hex.toLowerCase() === value.toLowerCase()
          const isTaken = taken.some((t) => t.toLowerCase() === c.hex.toLowerCase())
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChange(c.hex)}
              aria-pressed={selected}
              aria-label={`${c.name}${isTaken ? ' (used by someone else)' : ''}`}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-2xl p-1 text-xs font-medium text-ink-2',
                selected && 'bg-card-2',
              )}
            >
              <span
                className={clsx('flex size-11 items-center justify-center rounded-full transition', selected && 'ring-3 ring-ink ring-offset-2 ring-offset-card')}
                style={{ background: c.hex, color: readableTextOn(c.hex) }}
              >
                {selected && <Check className="size-6" strokeWidth={3} aria-hidden />}
                {!selected && isTaken && <span className="size-2 rounded-full bg-current opacity-70" aria-hidden />}
              </span>
              {c.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
