/**
 * MJ Social の定数と純粋関数（DBの enum と一致させる）
 */
import type { MetricStatus } from './metrics'

export type SocialPlatform = 'instagram' | 'tiktok'
export type PostFormat = 'reel' | 'feed_image' | 'carousel' | 'story' | 'short_video' | 'live' | 'other'
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type SocialMetric =
  | 'views'
  | 'reach'
  | 'likes'
  | 'comments'
  | 'saves'
  | 'shares'
  | 'profile_visits'
  | 'follows_gained'
  | 'link_clicks'
export type IdeaStatus = 'idea' | 'planning' | 'production' | 'ready' | 'published' | 'analyzed'

export const PLATFORM_LABEL: Record<SocialPlatform, string> = { instagram: 'Instagram', tiktok: 'TikTok' }
export const PLATFORMS: SocialPlatform[] = ['instagram', 'tiktok']

export const FORMAT_LABEL: Record<PostFormat, string> = {
  reel: 'リール',
  feed_image: 'フィード画像',
  carousel: 'カルーセル',
  story: 'ストーリーズ',
  short_video: 'ショート動画',
  live: 'ライブ',
  other: 'その他',
}
export const FORMATS = Object.keys(FORMAT_LABEL) as PostFormat[]

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  draft: '下書き',
  scheduled: '予約済み',
  published: '公開済み',
  archived: 'アーカイブ',
}
export const POST_STATUSES = Object.keys(POST_STATUS_LABEL) as PostStatus[]

export const METRICS: { id: SocialMetric; label: string }[] = [
  { id: 'views', label: '再生数' },
  { id: 'reach', label: 'リーチ' },
  { id: 'likes', label: 'いいね' },
  { id: 'comments', label: 'コメント' },
  { id: 'saves', label: '保存' },
  { id: 'shares', label: 'シェア' },
  { id: 'profile_visits', label: 'プロフィールアクセス' },
  { id: 'follows_gained', label: 'フォロワー増加' },
  { id: 'link_clicks', label: 'リンククリック' },
]
export const METRIC_IDS = METRICS.map((m) => m.id)
export const METRIC_LABEL = Object.fromEntries(METRICS.map((m) => [m.id, m.label])) as Record<SocialMetric, string>

export const IDEA_STATUSES: IdeaStatus[] = ['idea', 'planning', 'production', 'ready', 'published', 'analyzed']
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  idea: 'Idea',
  planning: 'Planning',
  production: 'Production',
  ready: 'Ready',
  published: 'Published',
  analyzed: 'Analyzed',
}
export const IDEA_STATUS_HINT: Record<IdeaStatus, string> = {
  idea: 'アイデア',
  planning: '企画中',
  production: '制作中',
  ready: '公開準備完了',
  published: '公開済み',
  analyzed: '振り返り済み',
}

export function nextIdeaStatus(s: IdeaStatus): IdeaStatus | null {
  const i = IDEA_STATUSES.indexOf(s)
  return IDEA_STATUSES[i + 1] ?? null
}
export function prevIdeaStatus(s: IdeaStatus): IdeaStatus | null {
  const i = IDEA_STATUSES.indexOf(s)
  return i > 0 ? (IDEA_STATUSES[i - 1] ?? null) : null
}

/** 公開からの経過時間のプリセット（24時間後・72時間後・7日後） */
export const SNAPSHOT_PRESETS = [
  { id: '24h', label: '24時間後', hours: 24 },
  { id: '72h', label: '72時間後', hours: 72 },
  { id: '7d', label: '7日後', hours: 168 },
] as const

export function presetRecordedAt(publishedAt: string, hours: number): Date {
  const t = new Date(publishedAt).getTime()
  if (Number.isNaN(t)) throw new Error('invalid publishedAt')
  return new Date(t + hours * 3600_000)
}

/** フォームの1指標分の入力。value が空欄 & status=measured は「未記録」（行を作らない） */
export interface MetricInput {
  status: MetricStatus
  value: string
}

export type MetricPayload = { metric: SocialMetric; status: MetricStatus; value: number | null }

/**
 * フォーム入力を record_post_metrics に渡す配列に変換する。
 * 戻り値の errors が空でなければ保存しない。
 */
export function toMetricPayload(inputs: Partial<Record<SocialMetric, MetricInput>>): {
  payload: MetricPayload[]
  errors: Partial<Record<SocialMetric, string>>
} {
  const payload: MetricPayload[] = []
  const errors: Partial<Record<SocialMetric, string>> = {}
  for (const metric of METRIC_IDS) {
    const input = inputs[metric]
    if (!input) continue
    if (input.status !== 'measured') {
      payload.push({ metric, status: input.status, value: null })
      continue
    }
    const raw = input.value.trim().replace(/,/g, '')
    if (raw === '') continue // 未記録
    if (!/^\d+$/.test(raw)) {
      errors[metric] = '0以上の整数で入力してください'
      continue
    }
    const value = Number(raw)
    if (!Number.isSafeInteger(value)) {
      errors[metric] = '値が大きすぎます'
      continue
    }
    payload.push({ metric, status: 'measured', value })
  }
  return { payload, errors }
}

/** 追跡コード（UTM utm_content 用）を生成する。紛らわしい文字（0/o, 1/l）を除外 */
export function generateTrackingCode(random: () => number = Math.random): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(random() * chars.length)]
  return s
}

export function trackingUrl(baseUrl: string, platform: SocialPlatform, code: string): string {
  const u = new URL(baseUrl)
  u.searchParams.set('utm_source', platform)
  u.searchParams.set('utm_medium', 'social')
  u.searchParams.set('utm_content', code)
  return u.toString()
}
