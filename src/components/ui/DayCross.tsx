/**
 * A big cross drawn over a whole day tile, for a day that has ended with
 * something missed. Shape-based, so it works without colour too.
 */
export function DayCross({ strength = 'strong', colour = 'var(--color-missed)' }: { strength?: 'strong' | 'soft'; colour?: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      style={{ opacity: strength === 'strong' ? 0.75 : 0.35 }}
    >
      <line x1="10" y1="10" x2="90" y2="90" stroke={colour} strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1="90" y1="10" x2="10" y2="90" stroke={colour} strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
