import clsx from 'clsx'

export const PEOPLE_EMOJI = [
  '😀', '😎', '🤓', '🥳', '😺', '🐶', '🦊', '🐼', '🐯', '🦁', '🐸', '🐵',
  '🦄', '🐙', '🐢', '🦖', '🐝', '🦋', '🌸', '🌻', '⭐', '🌈', '⚽', '🎸',
  '🎨', '🚀', '🍕', '🧁', '👑', '🦸', '🧙', '👩', '👨', '👧', '👦', '👵',
]

interface Props {
  value: string
  onChange: (emoji: string) => void
  options?: string[]
  label?: string
}

export function EmojiPicker({ value, onChange, options = PEOPLE_EMOJI, label = 'Emoji' }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink-2">{label}</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
        {options.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Choose ${e}`}
            aria-pressed={value === e}
            onClick={() => onChange(e)}
            className={clsx(
              'flex aspect-square items-center justify-center rounded-2xl text-3xl transition',
              value === e ? 'bg-brand-100 ring-3 ring-brand-500 dark:bg-brand-700/40' : 'bg-card-2 hover:scale-105',
            )}
          >
            {e}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink-3">
        Or type any emoji:
        <input
          value={options.includes(value) ? '' : value}
          onChange={(ev) => ev.target.value.trim() && onChange(ev.target.value.trim().slice(0, 16))}
          className="h-11 w-20 rounded-xl border border-line bg-card text-center text-2xl"
          aria-label="Custom emoji"
          inputMode="text"
        />
      </label>
    </fieldset>
  )
}
