import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'success' | 'error'
interface ToastAction {
  label: string
  onClick: () => void
}
interface ToastItem {
  id: number
  kind: Kind
  text: string
  action?: ToastAction
}
type Show = (text: string, kind?: Kind, action?: ToastAction) => void

const ToastContext = createContext<Show>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const show = useCallback<Show>((text, kind = 'success', action) => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs, { id, kind, text, action }])
    // Reminders (with an action) stay longer so there's time to tap them.
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), action ? 8000 : kind === 'error' ? 5000 : 2600)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16 }}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl bg-ink px-4 py-3 font-medium text-app shadow-lg"
            >
              {t.kind === 'success' ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-400" aria-hidden />
              ) : (
                <AlertTriangle className="size-5 shrink-0 text-amber-400" aria-hidden />
              )}
              <span className="min-w-0 flex-1">{t.text}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick()
                    setItems((xs) => xs.filter((x) => x.id !== t.id))
                  }}
                  className="ml-1 min-h-9 shrink-0 rounded-full bg-white/20 px-3 text-sm font-bold"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
