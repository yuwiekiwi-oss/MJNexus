import { CircleDashed, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { KPI_DOMAIN_LABEL, type KpiDomain } from '@/lib/kpi-catalog'
import { SAMPLE_LEVEL_LABEL, type SampleLevel } from '@/lib/stats'

/** 記録に基づく経営指標であることを明示する */
export function DomainBadge({ domain }: { domain: KpiDomain }) {
  return (
    <Badge variant="default" title="問い合わせ・入会・費用の記録に基づく指標">
      {KPI_DOMAIN_LABEL[domain]}
    </Badge>
  )
}

/** データ量による検証レベル。データなしは「未検証」 */
export function SampleLevelBadge({ level }: { level: SampleLevel }) {
  const variant = level === 'inferential' ? 'success' : level === 'none' ? 'soon' : 'warning'
  return (
    <Badge variant={variant}>
      {level === 'none' ? <CircleDashed /> : <Info />}
      {SAMPLE_LEVEL_LABEL[level]}
    </Badge>
  )
}
