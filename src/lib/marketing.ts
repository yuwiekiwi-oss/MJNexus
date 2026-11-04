/**
 * MJ Marketing（集客）の定義と計算。
 * 件数はDB（marketing_funnel）が数え、ここでは率・単価を「件数どうしの割り算」で出すだけ。
 * 分母が0、または費用が未記録・権限なしのときは null（= 計算不能）を返し、0 にしない。
 */

/** 集客チャネルが SNS の場合のプラットフォーム */
export type SocialPlatform = 'instagram' | 'tiktok'
export const PLATFORMS: SocialPlatform[] = ['instagram', 'tiktok']
export const PLATFORM_LABEL: Record<SocialPlatform, string> = { instagram: 'Instagram', tiktok: 'TikTok' }

export type AttributionMethod = 'tracked_link' | 'self_reported' | 'staff_inferred' | 'unknown'
export type TrialStatus = 'booked' | 'attended' | 'no_show' | 'cancelled'
export type ChannelKind = 'organic_social' | 'paid_social' | 'search' | 'referral' | 'offline' | 'web' | 'other'
export type MarketingExpenseCategory = 'ad_spend' | 'campaign' | 'content_production'
export type InquiryStage = 'new' | 'trial_booked' | 'trial_attended' | 'trial_missed' | 'enrolled' | 'closed_lost'
export type FunnelGroup = 'total' | 'channel' | 'attribution'

export const ATTRIBUTIONS: AttributionMethod[] = ['tracked_link', 'self_reported', 'staff_inferred', 'unknown']
export const ATTRIBUTION_LABEL: Record<AttributionMethod, string> = {
  tracked_link: '追跡リンク',
  self_reported: '本人の回答',
  staff_inferred: 'スタッフの推定',
  unknown: '不明',
}
export const ATTRIBUTION_HINT: Record<AttributionMethod, string> = {
  tracked_link: 'UTM付きのリンクから来たことが流入URLで確認できる（確度が高い）',
  self_reported: '「何で知りましたか」への回答（参考値）',
  staff_inferred: '会話などからの推定（参考値）',
  unknown: 'きっかけが分からない',
}

export const TRIAL_STATUS_LABEL: Record<TrialStatus, string> = {
  booked: '申込済み',
  attended: '参加',
  no_show: '欠席',
  cancelled: 'キャンセル',
}

export const STAGE_LABEL: Record<InquiryStage, string> = {
  new: '問い合わせ',
  trial_booked: '体験申込',
  trial_attended: '体験参加',
  trial_missed: '体験未参加',
  enrolled: '入会',
  closed_lost: '失注',
}

export const CHANNEL_KINDS: ChannelKind[] = ['organic_social', 'paid_social', 'search', 'referral', 'offline', 'web', 'other']
export const CHANNEL_KIND_LABEL: Record<ChannelKind, string> = {
  organic_social: 'SNS（オーガニック）',
  paid_social: 'SNS広告',
  search: '検索',
  referral: '紹介',
  offline: 'オフライン（チラシ等）',
  web: 'Webサイト',
  other: 'その他',
}

export const MARKETING_EXPENSE_CATEGORIES: MarketingExpenseCategory[] = ['ad_spend', 'campaign', 'content_production']
export const EXPENSE_CATEGORY_LABEL: Record<MarketingExpenseCategory, string> = {
  ad_spend: '広告費',
  campaign: 'キャンペーン費',
  content_production: '制作外注費',
}

export const FUNNEL_GROUPS: FunnelGroup[] = ['total', 'channel', 'attribution']
export const FUNNEL_GROUP_LABEL: Record<FunnelGroup, string> = {
  total: '全体',
  channel: 'チャネル別',
  attribution: 'きっかけの確度別',
}

/** 学年（DB: 小1=1 … 中3=9） */
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export function gradeLabel(g: number | null | undefined): string {
  if (!g) return '—'
  return g <= 6 ? `小${g}` : `中${g - 6}`
}

/** 自由記述に個人情報らしき文字列（メール・電話番号）が含まれていないか */
export function looksLikePii(text: string): boolean {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text) || /0\d{9,10}/.test(text) || /0\d{1,4}-\d{1,4}-\d{4}/.test(text)
}

export interface LandingParams {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
}

/** 問い合わせフォームに記録された流入URL（またはクエリ文字列）からUTMを取り出す */
export function parseLanding(input: string): LandingParams | null {
  const s = input.trim()
  if (!s) return null
  let params: URLSearchParams
  try {
    params = s.includes('://') ? new URL(s).searchParams : new URLSearchParams(s.replace(/^\?/, ''))
  } catch {
    return null
  }
  const get = (k: string) => {
    const v = params.get(k)?.trim().toLowerCase()
    return v ? v.slice(0, 100) : null
  }
  const out = {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
  }
  return Object.values(out).some(Boolean) ? out : null
}


/** marketing_funnel() の1行 */
export type FunnelRow = {
  group_key: string
  group_label: string | null
  inquiries: number
  tracked_inquiries: number
  trial_booked: number
  trial_attended: number
  enrolled: number
  closed_lost: number
  open_recent: number
  median_days_to_enroll: number | null
  /** NULL = 費用の記録なし、または権限なし（cost_visible で区別） */
  cost_jpy: number | null
  cost_visible: boolean
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

export type CostState = 'recorded' | 'not_recorded' | 'no_permission' | 'not_applicable'

export function costState(row: FunnelRow, group: FunnelGroup): CostState {
  if (group !== 'total' && group !== 'channel') return 'not_applicable'
  if (!row.cost_visible) return 'no_permission'
  return row.cost_jpy === null ? 'not_recorded' : 'recorded'
}

export const COST_STATE_LABEL: Record<Exclude<CostState, 'recorded'>, string> = {
  not_recorded: '費用未記録',
  no_permission: '権限なし',
  not_applicable: '—',
}

export interface FunnelRates {
  trialBookingRate: number | null
  trialAttendanceRate: number | null
  trialToEnrollment: number | null
  inquiryToEnrollment: number | null
  cpa: number | null
  cac: number | null
}

/** 率・単価（kpi-catalog の trial_booking_rate など。分母は問い合わせ月コホート） */
export function funnelRates(row: FunnelRow): FunnelRates {
  const cost = row.cost_visible ? row.cost_jpy : null
  return {
    trialBookingRate: ratio(row.trial_booked, row.inquiries),
    trialAttendanceRate: ratio(row.trial_attended, row.trial_booked),
    trialToEnrollment: ratio(row.enrolled, row.trial_attended),
    inquiryToEnrollment: ratio(row.enrolled, row.inquiries),
    cpa: cost === null ? null : ratio(cost, row.inquiries),
    cac: cost === null ? null : ratio(cost, row.enrolled),
  }
}

/** 期間の終わりが直近30日以内なら、まだ入会判断前の問い合わせを含む（成熟していないコホート） */
export function isImmatureCohort(to: string, today: string): boolean {
  const end = Date.parse(`${to}T00:00:00+09:00`)
  const now = Date.parse(`${today}T00:00:00+09:00`)
  return now - end < 30 * 86_400_000
}

/** 日本時間の今日（YYYY-MM-DD） */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}

export type PeriodPreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months'
export const PERIOD_PRESET_LABEL: Record<PeriodPreset, string> = {
  this_month: '今月',
  last_month: '先月',
  last_3_months: '直近3か月',
  last_6_months: '直近6か月',
}

/** 期間プリセット → [from, to]（日本時間の日付、月単位） */
export function presetPeriod(preset: PeriodPreset, today: string): [string, string] {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const first = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10)
  const last = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10)
  switch (preset) {
    case 'this_month':
      return [first(y, m), today]
    case 'last_month':
      return [first(y, m - 1), last(y, m - 1)]
    case 'last_3_months':
      return [first(y, m - 2), today]
    case 'last_6_months':
      return [first(y, m - 5), today]
  }
}
