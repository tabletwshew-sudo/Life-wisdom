import clsx from 'clsx'
import { tint } from '@/lib/colours'

interface Props {
  emoji: string
  colour: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'size-8 text-base ring-2',
  md: 'size-11 text-2xl ring-[3px]',
  lg: 'size-14 text-3xl ring-[3px]',
  xl: 'size-24 text-5xl ring-4',
}

/** An emoji in a circle tinted with the person's colour, with a coloured ring. */
export function Avatar({ emoji, colour, name, size = 'md', className }: Props) {
  return (
    <span
      role={name ? 'img' : undefined}
      aria-label={name}
      title={name}
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-full leading-none', sizes[size], className)}
      style={{ background: tint(colour, 0.2), ['--tw-ring-color' as string]: colour }}
    >
      <span aria-hidden>{emoji}</span>
    </span>
  )
}
