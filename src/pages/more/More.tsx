import clsx from 'clsx'
import { Bell, Download, KeyRound, LogOut, Moon, Palette, Shield, SlidersHorizontal, Sun, SunMoon, Tags, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { useTheme, type ThemeChoice } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import { SettingsGroup, SettingsRow } from './SettingsList'

export default function More() {
  const { me, family, members, isAdmin, families, switchFamily } = useCurrentFamily()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/signin', { replace: true })
  }

  return (
    <>
      <PageHeader title="More" />

      <Link to="/more/profile">
        <Card className="mb-5 flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
          <Avatar emoji={me.emoji} colour={me.colour} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{me.displayName}</p>
            <p className="text-ink-3">
              {isAdmin ? 'Admin' : 'Member'} · {family.name}
            </p>
          </div>
          <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">Edit</span>
        </Card>
      </Link>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          <SettingsGroup title="Family">
            <SettingsRow to="/more/family" icon={<Users className="size-5" />} iconBg="bg-[#0072B2]" label="Members & invite" detail={`${members.length}`} />
            {isAdmin && (
              <SettingsRow to="/more/family-settings" icon={<SlidersHorizontal className="size-5" />} iconBg="bg-[#009E73]" label="Family settings" />
            )}
            <SettingsRow to="/more/categories" icon={<Tags className="size-5" />} iconBg="bg-[#E69F00]" label="Colour categories" />
            {families.length > 1 &&
              families
                .filter((f) => f.id !== family.id)
                .map((f) => (
                  <SettingsRow key={f.id} onClick={() => switchFamily(f.id)} icon={<Users className="size-5" />} iconBg="bg-[#CC79A7]" label={`Switch to ${f.name}`} />
                ))}
          </SettingsGroup>

          <SettingsGroup title="Appearance">
            <div className="p-3">
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-2xl bg-card-2 p-1">
                {(
                  [
                    ['system', 'Auto', SunMoon],
                    ['light', 'Light', Sun],
                    ['dark', 'Dark', Moon],
                  ] as [ThemeChoice, string, typeof Sun][]
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={theme === value}
                    onClick={() => setTheme(value)}
                    className={clsx(
                      'flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold',
                      theme === value ? 'bg-card shadow-sm' : 'text-ink-3',
                    )}
                  >
                    <Icon className="size-4" aria-hidden /> {label}
                  </button>
                ))}
              </div>
            </div>
          </SettingsGroup>
        </div>

        <div>
          <SettingsGroup title="App">
            <SettingsRow to="/more/install" icon={<Download className="size-5" />} iconBg="bg-[#7B61FF]" label="Install on your phone" />
            <SettingsRow icon={<Bell className="size-5" />} iconBg="bg-[#E5446D]" label="Notifications" badge="Phase 5" />
            <SettingsRow icon={<KeyRound className="size-5" />} iconBg="bg-[#1B998B]" label="Encryption" badge="Phase 6" />
            <SettingsRow to="/more/privacy" icon={<Shield className="size-5" />} iconBg="bg-[#56B4E9]" label="Privacy & your data" />
            <SettingsRow to="/more/profile" icon={<Palette className="size-5" />} iconBg="bg-[#D55E00]" label="Profile, emoji & colour" />
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow onClick={signOut} icon={<LogOut className="size-5" />} iconBg="bg-red-600" label="Sign out" danger />
          </SettingsGroup>
        </div>
      </div>

      <p className="pb-4 text-center text-xs text-ink-3">Family Hub · version {__APP_VERSION__}</p>
    </>
  )
}
