import { X } from 'lucide-react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsDesktop } from '@/hooks/useMediaQuery'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * A bottom sheet on phones (drag down to close) and a centred dialog on
 * larger screens. The rest of the app is made `inert` while it is open so
 * keyboard and screen-reader focus stays inside.
 */
export function Sheet({ open, onClose, title, children, footer }: Props) {
  const desktop = useIsDesktop()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const root = document.getElementById('root')
    const previouslyFocused = document.activeElement as HTMLElement | null
    root?.setAttribute('inert', '')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select')
      ;(first ?? panelRef.current)?.focus()
    })
    return () => {
      root?.removeAttribute('inert')
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative flex max-h-[92dvh] w-full flex-col rounded-t-[1.75rem] bg-card shadow-2xl outline-none md:max-w-lg md:rounded-[1.75rem]"
            initial={desktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            drag={desktop ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            {!desktop && <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" aria-hidden />}
            <div className="flex items-center gap-2 px-5 pt-3 pb-2">
              <h2 id={titleId} className="flex-1 text-xl font-bold">
                {title}
              </h2>
              <button onClick={onClose} className="flex size-11 items-center justify-center rounded-full bg-card-2" aria-label="Close">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && <div className="border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
            {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
