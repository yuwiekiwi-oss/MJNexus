import { CircleDashed, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { KPI_DOMAIN_LABEL, type KpiDomain } from '@/lib/kpi-catalog'
import { SAMPLE_LEVEL_LABEL, type SampleLevel } from '@/lib/stats'

/** SNS指標か経営指標かを常に明示する */
export function DomainBadge({ domain }: { domain: KpiDomain }) {
  return (
    <Badge variant={domain === 'social' ? 'secondary' : 'default'} title={domain === 'social' ? 'プラットフォームの集計値に基づく指標' : '問い合わせ・入会・売上などの記録に基づく指標'}>
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
