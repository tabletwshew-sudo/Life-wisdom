import { motion } from 'motion/react'

const PIECES = ['✨', '⭐', '🎉', '✨', '💫', '⭐', '✨', '🎊']

/** A little celebratory burst of emoji (played when a task is ticked). */
export function Burst() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {PIECES.map((p, i) => {
        const angle = (i / PIECES.length) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute text-sm"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: Math.cos(angle) * 34, y: Math.sin(angle) * 34, opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {p}
          </motion.span>
        )
      })}
    </span>
  )
}
