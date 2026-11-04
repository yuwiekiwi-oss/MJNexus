/**
 * デモ表示専用の集客サンプルデータ（架空）。VITE_DEMO_MODE=true のプレビューでのみ読み込む。
 * - 生徒の呼び名にも【サンプル】を付ける。連絡先（個人情報）はサンプルでも作らない。
 * - ファネルの集計は SQL 関数 marketing_funnel と同じ規則をここで再現しているが、
 *   本番の計算は SQL が正（この関数は表示確認用）。
 */
import type { AttributionMethod, FunnelGroup, FunnelRow, InquiryStage, TrialStatus } from '@/lib/marketing'
import type {
  CourseRow,
  EnrollmentRow,
  InquiryPipelineRow,
  MarketingChannelRow,
  MarketingCostRow,
  TrialLessonRow,
} from '@/types/database'
export const DEMO_ORG_ID = 'demo-org'

const created = '2026-08-01T00:00:00Z'
const jst = (d: string, hm = '10:00') => new Date(`${d}T${hm}:00+09:00`).toISOString()

export const demoChannels: MarketingChannelRow[] = [
  { id: 'demo-ch-ig', code: 'instagram', name: 'Instagram（オーガニック）', kind: 'organic_social', platform: 'instagram' },
  { id: 'demo-ch-tt', code: 'tiktok', name: 'TikTok（オーガニック）', kind: 'organic_social', platform: 'tiktok' },
  { id: 'demo-ch-ads', code: 'instagram_ads', name: '【サンプル】Instagram広告', kind: 'paid_social', platform: 'instagram' },
  { id: 'demo-ch-ref', code: 'referral', name: '紹介', kind: 'referral', platform: null },
  { id: 'demo-ch-web', code: 'web', name: 'Webサイト・検索', kind: 'web', platform: null },
].map((c) => ({ ...c, organization_id: DEMO_ORG_ID, is_active: true, created_at: created }) as MarketingChannelRow)

export const demoCampaigns = [
  {
    id: 'demo-cp-1',
    organization_id: DEMO_ORG_ID,
    channel_id: 'demo-ch-ads',
    name: '【サンプル】秋の体験会キャンペーン',
    utm_campaign: 'autumn_trial',
    starts_on: '2026-09-15',
    ends_on: '2026-10-31',
    budget_jpy: 30000,
    notes: null,
    created_at: created,
    updated_at: created,
  },
]

export const demoCourses: CourseRow[] = [
  { id: 'demo-course-1', organization_id: DEMO_ORG_ID, name: '【サンプル】Robloxスタンダード', monthly_fee_jpy: 12000, is_active: true, created_at: created },
  { id: 'demo-course-2', organization_id: DEMO_ORG_ID, name: '【サンプル】AIプログラミング', monthly_fee_jpy: 15000, is_active: true, created_at: created },
]

type Spec = {
  id: string
  at: string
  ch: string | null
  attr: AttributionMethod
  grade: number | null
  trials: [string, TrialStatus][]
  enrolled?: string
  lost?: string
}

// 問い合わせ（架空）。9〜10月が中心
const specs: Spec[] = [
  { id: 'q01', at: '2026-09-02', ch: 'demo-ch-tt', attr: 'tracked_link', grade: 5, trials: [['2026-09-07', 'attended']], enrolled: '2026-09-14' },
  { id: 'q02', at: '2026-09-04', ch: 'demo-ch-ig', attr: 'self_reported', grade: 4, trials: [['2026-09-12', 'attended']], enrolled: '2026-09-25' },
  { id: 'q03', at: '2026-09-06', ch: 'demo-ch-ref', attr: 'unknown', grade: 6, trials: [['2026-09-13', 'attended']], enrolled: '2026-09-20' },
  { id: 'q04', at: '2026-09-10', ch: 'demo-ch-web', attr: 'unknown', grade: 3, trials: [['2026-09-19', 'cancelled']], lost: '2026-09-30' },
  { id: 'q05', at: '2026-09-15', ch: 'demo-ch-tt', attr: 'tracked_link', grade: 7, trials: [['2026-09-21', 'no_show'], ['2026-09-28', 'attended']], enrolled: '2026-10-05' },
  { id: 'q06', at: '2026-09-18', ch: 'demo-ch-ads', attr: 'tracked_link', grade: 5, trials: [['2026-09-26', 'attended']], lost: '2026-10-10' },
  { id: 'q07', at: '2026-09-22', ch: 'demo-ch-ads', attr: 'tracked_link', grade: 4, trials: [] },
  { id: 'q08', at: '2026-09-27', ch: 'demo-ch-ig', attr: 'staff_inferred', grade: 2, trials: [['2026-10-04', 'attended']], enrolled: '2026-10-18' },
  { id: 'q09', at: '2026-10-03', ch: 'demo-ch-tt', attr: 'self_reported', grade: 6, trials: [['2026-10-10', 'attended']], lost: '2026-10-25' },
  { id: 'q10', at: '2026-10-08', ch: 'demo-ch-ads', attr: 'tracked_link', grade: 5, trials: [['2026-10-17', 'attended']], enrolled: '2026-10-24' },
  { id: 'q11', at: '2026-10-14', ch: 'demo-ch-ig', attr: 'tracked_link', grade: 8, trials: [['2026-10-24', 'cancelled']] },
  { id: 'q12', at: '2026-10-20', ch: 'demo-ch-tt', attr: 'tracked_link', grade: 7, trials: [['2026-10-31', 'attended']] },
  { id: 'q13', at: '2026-10-25', ch: null, attr: 'unknown', grade: null, trials: [] },
  { id: 'q14', at: '2026-10-29', ch: 'demo-ch-ig', attr: 'tracked_link', grade: 5, trials: [['2026-11-08', 'booked']] },
  { id: 'q15', at: '2026-11-02', ch: 'demo-ch-tt', attr: 'self_reported', grade: 6, trials: [] },
]

export const demoTrials: TrialLessonRow[] = specs.flatMap((s) =>
  s.trials.map(([d, status], i) => ({
    id: `demo-trial-${s.id}-${i}`,
    organization_id: DEMO_ORG_ID,
    inquiry_id: `demo-${s.id}`,
    booked_at: jst(s.at, '12:00'),
    scheduled_at: jst(d, '16:00'),
    status,
    attended_at: status === 'attended' ? jst(d, '16:00') : null,
    cancelled_at: status === 'cancelled' ? jst(d, '09:00') : null,
    notes: null,
    created_at: created,
    updated_at: created,
  })),
)

export const demoEnrollments: EnrollmentRow[] = specs
  .filter((s) => s.enrolled)
  .map((s, i) => ({
    id: `demo-enr-${s.id}`,
    organization_id: DEMO_ORG_ID,
    student_id: `demo-student-${i}`,
    course_id: i % 3 === 2 ? 'demo-course-2' : 'demo-course-1',
    inquiry_id: `demo-${s.id}`,
    enrolled_on: s.enrolled!,
    ended_on: null,
    status: 'active',
    monthly_fee_jpy: i % 3 === 2 ? 15000 : 12000,
    created_at: created,
    updated_at: created,
  }))

export const demoCosts: MarketingCostRow[] = [
  ['2026-09-15', 'ad_spend', 12000, 'demo-ch-ads', '【サンプル】広告配信 9月'],
  ['2026-10-01', 'ad_spend', 18000, 'demo-ch-ads', '【サンプル】広告配信 10月'],
  ['2026-09-20', 'content_production', 8000, 'demo-ch-ig', '【サンプル】リール撮影の外注'],
  ['2026-10-10', 'campaign', 5000, 'demo-ch-ref', '【サンプル】紹介特典'],
].map(([d, category, amount, ch, desc], i) => ({
  id: `demo-cost-${i}`,
  organization_id: DEMO_ORG_ID,
  occurred_on: d as string,
  category: category as MarketingCostRow['category'],
  amount_jpy: amount as number,
  channel_id: ch as string,
  campaign_id: ch === 'demo-ch-ads' ? 'demo-cp-1' : null,
  vendor: null,
  description: desc as string,
}))

function stageOf(s: Spec): InquiryStage {
  if (s.enrolled) return 'enrolled'
  if (s.lost) return 'closed_lost'
  if (s.trials.some(([, st]) => st === 'attended')) return 'trial_attended'
  if (s.trials.some(([, st]) => st === 'booked')) return 'trial_booked'
  return s.trials.length > 0 ? 'trial_missed' : 'new'
}

export const demoPipeline: InquiryPipelineRow[] = specs
  .map((s): InquiryPipelineRow => {
    const ch = demoChannels.find((c) => c.id === s.ch)
    const booked = s.trials.filter(([, st]) => st === 'booked').map(([d]) => jst(d, '16:00'))
    return {
      id: `demo-${s.id}`,
      organization_id: DEMO_ORG_ID,
      inquired_at: jst(s.at),
      channel_id: s.ch,
      channel_name: ch?.name ?? null,
      campaign_id: s.ch === 'demo-ch-ads' ? 'demo-cp-1' : null,
      campaign_name: s.ch === 'demo-ch-ads' ? demoCampaigns[0]!.name : null,
      attribution: s.attr,
      utm_source: s.attr === 'tracked_link' ? (ch?.code ?? null) : null,
      utm_medium: s.attr === 'tracked_link' ? 'social' : null,
      utm_campaign: s.ch === 'demo-ch-ads' ? 'autumn_trial' : null,
      utm_content: s.attr === 'tracked_link' ? `smp_${s.id}` : null,
      child_grade: s.grade,
      closed_lost_at: s.lost ? jst(s.lost) : null,
      closed_lost_reason: s.lost ? '【サンプル】日程が合わない' : null,
      notes: '【サンプル】Robloxでゲームを作ってみたい',
      trial_count: s.trials.length,
      attended_count: s.trials.filter(([, st]) => st === 'attended').length,
      next_trial_at: booked[0] ?? null,
      enrollment_visible: true,
      enrolled_on: s.enrolled ?? null,
      stage: stageOf(s),
    }
  })
  .reverse()

const median = (xs: number[]) => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** marketing_funnel と同じ規則（問い合わせ月コホート、日本時間の日付）での表示用集計 */
export function demoFunnel(args: { p_from: string; p_to: string; p_group?: FunnelGroup }, today: string): FunnelRow[] {
  const group = args.p_group ?? 'total'
  const inRange = specs.filter((s) => s.at >= args.p_from && s.at <= args.p_to)
  const keyOf = (s: Spec): string => {
    switch (group) {
      case 'total':
        return 'all'
      case 'channel':
        return s.ch ?? '_none'
      case 'attribution':
        return s.attr
    }
  }
  const costs = demoCosts.filter((c) => c.occurred_on >= args.p_from && c.occurred_on <= args.p_to)
  const costKey = (c: MarketingCostRow) => (group === 'total' ? 'all' : (c.channel_id ?? '_none'))
  const keys = new Set(inRange.map(keyOf))
  if (group === 'total' || group === 'channel') costs.forEach((c) => keys.add(costKey(c)))
  const recent = Date.parse(`${today}T00:00:00+09:00`) - 30 * 86_400_000

  const label = (k: string) => {
    if (group === 'total') return '全体'
    if (k === '_none') return 'チャネル未設定'
    if (group === 'channel') return demoChannels.find((c) => c.id === k)?.name ?? k
    return k
  }

  return [...keys]
    .map((k): FunnelRow => {
      const rows = inRange.filter((s) => keyOf(s) === k)
      const c = group === 'total' || group === 'channel' ? costs.filter((x) => costKey(x) === k) : []
      return {
        group_key: k,
        group_label: label(k),
        inquiries: rows.length,
        tracked_inquiries: rows.filter((s) => s.attr === 'tracked_link').length,
        trial_booked: rows.filter((s) => s.trials.length > 0).length,
        trial_attended: rows.filter((s) => s.trials.some(([, st]) => st === 'attended')).length,
        enrolled: rows.filter((s) => s.enrolled).length,
        closed_lost: rows.filter((s) => s.lost && !s.enrolled).length,
        open_recent: rows.filter((s) => !s.enrolled && !s.lost && Date.parse(jst(s.at)) > recent).length,
        median_days_to_enroll: median(rows.filter((s) => s.enrolled).map((s) => days(s.at, s.enrolled!))),
        cost_jpy: c.length ? c.reduce((a, x) => a + x.amount_jpy, 0) : null,
        cost_visible: true,
      }
    })
    .sort((a, b) => b.inquiries - a.inquiries || a.group_key.localeCompare(b.group_key))
}
