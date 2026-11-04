import { PageHeader } from '@/components/layout/page-header'
import { ComingSoonState } from '@/components/states/states'
import { Badge } from '@/components/ui/badge'
import type { NavItem } from '@/lib/nav'

export function ComingSoonPage({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader
        title={item.label}
        description={item.description}
        actions={<Badge variant="soon">Coming Soon</Badge>}
      />
      <ComingSoonState phase={item.phase} features={item.plannedFeatures} />
    </>
  )
}
