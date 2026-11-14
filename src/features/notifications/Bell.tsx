import clsx from 'clsx'
import { Bell as BellIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUnreadCount } from './api'

/** The bell with an unread count; shown in page headers on phones. */
export function Bell({ className }: { className?: string }) {
  const unread = useUnreadCount()
  return (
    <Link
      to="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      className={clsx('relative flex size-11 shrink-0 items-center justify-center rounded-full bg-card shadow-sm', className)}
    >
      <BellIcon className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-missed px-1 text-[11px] font-bold text-white" aria-hidden>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

export function UnreadPill() {
  const unread = useUnreadCount()
  if (!unread) return null
  return (
    <span className="ml-auto rounded-full bg-missed px-2 py-0.5 text-xs font-bold text-white" aria-label={`${unread} unread`}>
      {unread > 99 ? '99+' : unread}
    </span>
  )
}
