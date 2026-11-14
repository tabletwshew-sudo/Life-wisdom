import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { useShopping } from './api'
import { IdeasTab } from './tabs/IdeasTab'
import { PlanTab } from './tabs/PlanTab'
import { RecipeGrid } from './tabs/RecipeGrid'
import { ShoppingTab } from './tabs/ShoppingTab'

type Tab = 'plan' | 'recipes' | 'drinks' | 'shopping' | 'ideas'
const TABS: [Tab, string, string][] = [
  ['plan', 'Plan', '🗓️'],
  ['recipes', 'Recipes', '📖'],
  ['shopping', 'Shopping', '🛒'],
  ['drinks', 'Drinks', '🥤'],
  ['ideas', 'Ideas', '💡'],
]

export default function FoodPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'plan'
  const toBuy = (useShopping().data ?? []).filter((i) => !i.checked).length

  return (
    <>
      <PageHeader title="Food & Drink" />
      <div role="tablist" aria-label="Food sections" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {TABS.map(([t, label, emoji]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setParams({ tab: t }, { replace: true })}
            className={clsx(
              'inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full px-4 font-semibold transition',
              tab === t ? 'bg-brand-500 text-white shadow-md' : 'bg-card text-ink-2 shadow-sm',
            )}
          >
            <span aria-hidden>{emoji}</span> {label}
            {t === 'shopping' && toBuy > 0 && (
              <span className={clsx('rounded-full px-1.5 text-xs font-bold', tab === t ? 'bg-white/25' : 'bg-brand-100 text-brand-700 dark:bg-brand-700/40 dark:text-brand-200')}>
                {toBuy}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'plan' && <PlanTab />}
        {tab === 'recipes' && <RecipeGrid kind="food" />}
        {tab === 'drinks' && <RecipeGrid kind="drink" />}
        {tab === 'shopping' && <ShoppingTab />}
        {tab === 'ideas' && <IdeasTab />}
      </div>
    </>
  )
}
