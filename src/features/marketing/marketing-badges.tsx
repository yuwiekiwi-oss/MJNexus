import { Badge } from '@/components/ui/badge'
import { ATTRIBUTION_HINT, ATTRIBUTION_LABEL, type AttributionMethod, type InquiryStage, STAGE_LABEL } from '@/lib/marketing'

const STAGE_VARIANT: Record<InquiryStage, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  new: 'outline',
  trial_booked: 'secondary',
  trial_attended: 'secondary',
  trial_missed: 'warning',
  enrolled: 'success',
  closed_lost: 'destructive',
}

/** 進捗。null は「権限なし」（閲覧者は入会情報を読めない） */
export function StageBadge({ stage }: { stage: InquiryStage | null }) {
  if (stage === null) {
    return (
      <Badge variant="soon" title="入会情報は編集者以上のみ閲覧できます">
        権限なし
      </Badge>
    )
  }
  return <Badge variant={STAGE_VARIANT[stage]}>{STAGE_LABEL[stage]}</Badge>
}

/** きっかけの確度。追跡リンク以外は参考値 */
export function AttributionBadge({ value }: { value: AttributionMethod }) {
  return (
    <Badge variant={value === 'tracked_link' ? 'default' : 'outline'} title={ATTRIBUTION_HINT[value]}>
      {ATTRIBUTION_LABEL[value]}
      {value !== 'tracked_link' && value !== 'unknown' && '（参考）'}
    </Badge>
  )
}
