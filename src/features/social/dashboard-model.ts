/**
 * SNSダッシュボードの集計（純粋関数）。
 * 投稿ごとの値は SQL ビュー social_post_kpis が計算済み。ここではグループに分けて
 * 中央値・件数を出すだけで、率を計算し直さない。
 */
import { FORMAT_LABEL, PLATFORM_LABEL } from '@/lib/social'
import { type GroupSummary, sampleSizeLevel, type SampleLevel, summarizeByGroup } from '@/lib/stats'
import type { PostKpiRow } from '@/types/database'

export type Dimension = 'platform' | 'theme' | 'format' | 'hour' | 'cta'

export const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: 'platform', label: 'Instagram / TikTok' },
  { id: 'theme', label: '投稿テーマ' },
  { id: 'format', label: '投稿形式' },
  { id: 'hour', label: '公開時間帯' },
  { id: 'cta', label: 'CTA' },
]

/** 時間帯（日本時間）。細かく分けると各グループの件数が少なくなるため4区分 */
export function hourBand(hour: number | null): { key: string; label: string } | null {
  if (hour === null) return null
  if (hour >= 5 && hour < 11) return { key: '1-morning', label: '朝（5-11時）' }
  if (hour >= 11 && hour < 17) return { key: '2-day', label: '昼（11-17時）' }
  if (hour >= 17 && hour < 22) return { key: '3-evening', label: '夜（17-22時）' }
  return { key: '4-late', label: '深夜（22-5時）' }
}

export function groupOf(dim: Dimension, r: PostKpiRow): { key: string; label: string } | null {
  switch (dim) {
    case 'platform':
      return { key: r.platform, label: PLATFORM_LABEL[r.platform] }
    case 'theme':
      return r.theme_id ? { key: r.theme_id, label: r.theme_name ?? '(名称なし)' } : { key: '_none', label: 'テーマ未設定' }
    case 'format':
      return { key: r.format, label: FORMAT_LABEL[r.format] }
    case 'hour':
      return hourBand(r.published_hour_jst)
    case 'cta':
      return r.cta ? { key: r.cta, label: r.cta } : { key: '_none', label: 'CTAなし' }
  }
}

export type DashboardKpiId =
  | 'engagement_rate_reach'
  | 'engagement_rate_views'
  | 'save_rate'
  | 'share_rate'
  | 'profile_visit_rate'
  | 'link_click_rate'
  | 'reach_per_production_hour'
  | 'views'
  | 'reach'
  | 'follows_gained'

export const DASHBOARD_KPIS: DashboardKpiId[] = [
  'engagement_rate_reach',
  'save_rate',
  'profile_visit_rate',
  'reach',
  'views',
  'follows_gained',
  'share_rate',
  'engagement_rate_views',
  'link_click_rate',
  'reach_per_production_hour',
]

export function kpiValue(id: DashboardKpiId, r: PostKpiRow): number | null {
  const v = r[id]
  return v === null || v === undefined ? null : Number(v)
}

/** 分析対象: 公開済みで、実績が1回以上記録された投稿 */
export function analyzablePosts(rows: readonly PostKpiRow[]): PostKpiRow[] {
  return rows.filter((r) => r.status === 'published' && r.snapshot_count > 0)
}

export interface Coverage {
  totalPosts: number
  publishedPosts: number
  recordedPosts: number
  periodStart: string | null
  periodEnd: string | null
  /** 指標ごとの「最新記録で実測でない」割合（未記録・未取得・非対応を含む） */
  notMeasuredRate: Record<string, number>
  level: SampleLevel
}

export function coverage(rows: readonly PostKpiRow[]): Coverage {
  const published = rows.filter((r) => r.status === 'published')
  const recorded = analyzablePosts(rows)
  const dates = recorded.map((r) => r.published_at).filter((d): d is string => Boolean(d)).sort()
  const notMeasuredRate: Record<string, number> = {}
  for (const m of ['views', 'reach', 'likes', 'saves', 'shares', 'profile_visits', 'follows_gained', 'link_clicks'] as const) {
    notMeasuredRate[m] = recorded.length ? recorded.filter((r) => r[`${m}_status`] !== 'measured').length / recorded.length : 0
  }
  return {
    totalPosts: rows.length,
    publishedPosts: published.length,
    recordedPosts: recorded.length,
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
    notMeasuredRate,
    level: sampleSizeLevel(recorded.length),
  }
}

export function compareGroups(rows: readonly PostKpiRow[], dim: Dimension, kpi: DashboardKpiId): GroupSummary[] {
  return summarizeByGroup(analyzablePosts(rows), (r) => groupOf(dim, r), (r) => kpiValue(kpi, r))
}

/** 比較の結論を出してよいか: すべてのグループで n≥30 のときだけ */
export function comparisonLevel(groups: readonly GroupSummary[]): SampleLevel {
  if (groups.length === 0) return 'none'
  const minN = Math.min(...groups.map((g) => g.n))
  return sampleSizeLevel(minN)
}
