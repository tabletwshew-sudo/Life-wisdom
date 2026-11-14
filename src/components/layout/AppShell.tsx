import clsx from 'clsx'
import { WifiOff } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useEventRealtime } from '@/features/calendar/api'
import { useTaskRealtime } from '@/features/tasks/api'
import { useFamily } from '@/family/FamilyProvider'
import { useOnline } from '@/hooks/useOnline'
import { NAV } from './nav'

export function AppShell() {
  const online = useOnline()
  const { family, me } = useFamily()
  useTaskRealtime()
  useEventRealtime()

  return (
    <div className="min-h-dvh md:flex">
      {/* Side navigation — tablets and desktops */}
      <nav
        aria-label="Main"
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-card px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 pl-[max(0.75rem,env(safe-area-inset-left))] md:flex"
      >
        <div className="mb-5 flex items-center gap-3 px-2">
          <img src="/logo.svg" alt="" className="size-10 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate font-extrabold">Family Hub</p>
            <p className="truncate text-sm text-ink-3">{family?.name}</p>
          </div>
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold transition',
                isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-200' : 'text-ink-2 hover:bg-card-2',
              )
            }
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </NavLink>
        ))}
        {me && (
          <NavLink to="/more/profile" className="mt-auto flex items-center gap-3 rounded-xl p-2 hover:bg-card-2">
            <Avatar emoji={me.emoji} colour={me.colour} size="sm" />
            <span className="truncate font-medium">{me.displayName}</span>
          </NavLink>
        )}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {!online && (
          <div
            role="status"
            className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-amber-100 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100"
          >
            <WifiOff className="size-4" aria-hidden /> You’re offline. Changes will need a connection.
          </div>
        )}
        <main
          id="main"
          className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:px-8 md:pt-8 md:pb-10"
        >
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar — phones */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/90 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition',
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-ink-3',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={clsx('flex h-8 w-14 items-center justify-center rounded-full transition', isActive && 'bg-brand-100 dark:bg-brand-700/40')}>
                      <Icon className="size-6" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
