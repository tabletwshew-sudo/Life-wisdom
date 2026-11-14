import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

export default function ComingSoon({ title, emoji, phase }: { title: string; emoji: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState emoji={emoji} title={`${title} is coming in Phase ${phase}`}>
          The navigation and layout are ready; this page gets built next.
        </EmptyState>
      </Card>
    </>
  )
}
