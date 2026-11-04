/**
 * デモ表示専用のサンプルデータ（架空）。
 *
 * - VITE_DEMO_MODE=true でビルドしたプレビューでのみ使う。本番ビルド・DBには一切入らない。
 * - タイトルには必ず【サンプル】を付け、画面上部にもデモであることを表示する。
 * - 率の計算は SQL ビュー social_post_snapshot_kpis と同じ規則をここで再現しているが、
 *   本番の計算はSQLが正（この関数は表示確認用）。
 */
import type { MetricStatus } from '@/lib/metrics'
import { METRIC_IDS, type PostFormat, type SocialMetric, type SocialPlatform } from '@/lib/social'
import type { ContentIdeaRow, PostKpiRow, SnapshotKpiRow, SocialPostRow } from '@/types/database'

export const DEMO_ORG_ID = 'demo-org'
const now = '2026-11-01T00:00:00Z'

export const demoAccounts = [
  { id: 'demo-ig', organization_id: DEMO_ORG_ID, platform: 'instagram' as const, handle: 'mj_sample_ig', display_name: null, is_active: true, created_at: now, updated_at: now },
  { id: 'demo-tt', organization_id: DEMO_ORG_ID, platform: 'tiktok' as const, handle: 'mj_sample_tt', display_name: null, is_active: true, created_at: now, updated_at: now },
]

const themeNames = ['Robloxゲーム完成動画', 'AIを使ったゲーム制作過程', 'Vibe Codingの紹介', 'Roblox Studioのチュートリアル', '保護者向け教育コンテンツ', '体験授業の案内']
export const demoThemes = themeNames.map((name, i) => ({
  id: `demo-theme-${i + 1}`,
  organization_id: DEMO_ORG_ID,
  name,
  description: null,
  sort_order: (i + 1) * 10,
  is_active: true,
  created_at: now,
}))

type Spec = {
  id: string
  account: 'demo-ig' | 'demo-tt'
  title: string
  theme: number
  format: PostFormat
  published: string
  minutes: number
  cta: string | null
  idea?: string
  /** 72時間後時点の [再生, リーチ, いいね, コメント, 保存, シェア, プロフィール, フォロワー増, リンク] */
  base: [number, number, number, number, number, number, number, number, number]
}

const specs: Spec[] = [
  { id: 'demo-p1', account: 'demo-tt', title: '【サンプル】小5が作った脱出ゲーム完成動画', theme: 0, format: 'short_video', published: '2026-10-03T10:00:00Z', minutes: 90, cta: 'プロフィールから体験授業へ', base: [5200, 4100, 310, 22, 64, 40, 120, 18, 0] },
  { id: 'demo-p2', account: 'demo-ig', title: '【サンプル】AIに指示してボスを作るまで', theme: 1, format: 'reel', published: '2026-10-05T11:00:00Z', minutes: 150, cta: 'プロフィールから体験授業へ', idea: 'demo-i5', base: [2100, 1600, 140, 9, 88, 12, 64, 6, 9] },
  { id: 'demo-p3', account: 'demo-ig', title: '【サンプル】保護者向け: 子どもとAIの付き合い方', theme: 4, format: 'carousel', published: '2026-10-09T12:00:00Z', minutes: 120, cta: '保存して後で読む', base: [0, 900, 70, 5, 120, 15, 30, 4, 3] },
  { id: 'demo-p4', account: 'demo-tt', title: '【サンプル】Vibe Codingって何？30秒で解説', theme: 2, format: 'short_video', published: '2026-10-12T09:30:00Z', minutes: 45, cta: null, base: [8800, 7000, 420, 35, 50, 70, 90, 25, 0] },
  { id: 'demo-p5', account: 'demo-ig', title: '【サンプル】Roblox Studio 初めの3ステップ', theme: 3, format: 'reel', published: '2026-10-16T10:00:00Z', minutes: 80, cta: '保存して後で読む', base: [3000, 2300, 160, 12, 140, 20, 55, 7, 6] },
  { id: 'demo-p6', account: 'demo-tt', title: '【サンプル】体験授業の様子（中1）', theme: 5, format: 'short_video', published: '2026-10-19T11:00:00Z', minutes: 60, cta: 'プロフィールから体験授業へ', base: [2400, 1900, 95, 8, 15, 6, 70, 5, 0] },
  { id: 'demo-p7', account: 'demo-ig', title: '【サンプル】完成したアスレチックゲームで遊んでみた', theme: 0, format: 'reel', published: '2026-10-23T12:30:00Z', minutes: 100, cta: null, base: [4100, 3200, 260, 18, 45, 30, 80, 10, 11] },
  { id: 'demo-p8', account: 'demo-tt', title: '【サンプル】AIがバグを直してくれた瞬間', theme: 1, format: 'short_video', published: '2026-10-27T10:00:00Z', minutes: 70, cta: null, base: [6100, 5000, 380, 41, 90, 55, 85, 20, 0] },
]

/** 72時間後を1としたときの成長倍率 */
const GROWTH: Record<number, number> = { 24: 0.55, 72: 1, 168: 1.25 }

function status(platform: SocialPlatform, metric: SocialMetric, format: PostFormat): MetricStatus {
  if (platform === 'tiktok' && metric === 'link_clicks') return 'unsupported'
  if (platform === 'instagram' && metric === 'follows_gained') return 'not_collected'
  if (format === 'carousel' && metric === 'views') return 'unsupported'
  return 'measured'
}

function rate(num: number | null, den: number | null): number | null {
  return num === null || den === null || den === 0 ? null : num / den
}

export function snapshotRow(post: SocialPostRow, platform: SocialPlatform, hours: number, base: Spec['base']): SnapshotKpiRow {
  const published = new Date(post.published_at!).getTime()
  const m = {} as Record<SocialMetric, number | null> & Record<`${SocialMetric}_status`, MetricStatus | null>
  METRIC_IDS.forEach((id, i) => {
    const st = status(platform, id, post.format)
    // サンプルでは 24時間後の保存数を「未取得」にして、記録漏れの表示を確認できるようにする
    const s: MetricStatus = hours === 24 && id === 'saves' && post.id === 'demo-p7' ? 'not_collected' : st
    m[`${id}_status`] = s
    m[id] = s === 'measured' ? Math.round(base[i]! * (GROWTH[hours] ?? 1)) : null
  })
  const parts = [m.likes, m.comments, m.saves, m.shares]
  const engagements = parts.every((x) => x !== null) ? (parts as number[]).reduce((a, b) => a + b, 0) : null
  return {
    ...m,
    organization_id: DEMO_ORG_ID,
    post_id: post.id,
    snapshot_id: `${post.id}-${hours}`,
    recorded_at: new Date(published + hours * 3600_000).toISOString(),
    source: 'manual',
    hours_since_publish: hours,
    engagements,
    engagement_rate_reach: rate(engagements, m.reach),
    engagement_rate_views: rate(engagements, m.views),
    save_rate: rate(m.saves, m.reach),
    share_rate: rate(m.shares, m.reach),
    profile_visit_rate: rate(m.profile_visits, m.reach),
    link_click_rate: rate(m.link_clicks, m.profile_visits),
    reach_per_production_hour: m.reach !== null && post.production_minutes ? m.reach / (post.production_minutes / 60) : null,
  }
}

export const demoPosts: SocialPostRow[] = specs.map((s) => ({
  id: s.id,
  organization_id: DEMO_ORG_ID,
  account_id: s.account,
  content_idea_id: s.idea ?? null,
  theme_id: `demo-theme-${s.theme + 1}`,
  post_url: `https://example.invalid/sample/${s.id}`,
  title: s.title,
  format: s.format,
  caption: 'サンプルの説明文です。',
  hook: 'サンプルのフック',
  target_audience: '小学生の保護者',
  cta: s.cta,
  status: 'published',
  published_at: s.published,
  production_minutes: s.minutes,
  tracking_code: `smp${s.id.slice(-1)}x`,
  created_at: now,
  updated_at: now,
}))
demoPosts.push({
  ...demoPosts[0]!,
  id: 'demo-p9',
  title: '【サンプル】来週公開予定: 中2のレースゲーム',
  status: 'scheduled',
  published_at: null,
  post_url: null,
  content_idea_id: 'demo-i4',
  tracking_code: null,
})

export const demoSnapshots: SnapshotKpiRow[] = specs.flatMap((s) => {
  const post = demoPosts.find((p) => p.id === s.id)!
  const platform = s.account === 'demo-ig' ? 'instagram' : 'tiktok'
  // 最新の投稿は 72時間後までしか記録していない想定
  const hours = s.id === 'demo-p8' ? [24, 72] : [24, 72, 168]
  return hours.map((h) => snapshotRow(post, platform, h, s.base))
})

export const demoPostKpis: PostKpiRow[] = demoPosts.map((p) => {
  const acc = demoAccounts.find((a) => a.id === p.account_id)!
  const theme = demoThemes.find((t) => t.id === p.theme_id)
  const snaps = demoSnapshots.filter((s) => s.post_id === p.id)
  const latest = snaps.at(-1)
  const empty = Object.fromEntries(METRIC_IDS.flatMap((m) => [[m, null], [`${m}_status`, null]]))
  const hourJst = p.published_at ? (new Date(p.published_at).getUTCHours() + 9) % 24 : null
  return {
    ...(empty as object),
    ...(latest ?? {}),
    post_id: p.id,
    organization_id: DEMO_ORG_ID,
    account_id: p.account_id,
    platform: acc.platform,
    account_handle: acc.handle,
    title: p.title,
    theme_id: p.theme_id,
    theme_name: theme?.name ?? null,
    format: p.format,
    cta: p.cta,
    status: p.status,
    published_at: p.published_at,
    published_hour_jst: hourJst,
    published_dow_jst: null,
    production_minutes: p.production_minutes,
    content_idea_id: p.content_idea_id,
    tracking_code: p.tracking_code,
    snapshot_count: snaps.length,
    snapshot_id: latest?.snapshot_id ?? null,
    recorded_at: latest?.recorded_at ?? null,
    hours_since_publish: latest?.hours_since_publish ?? null,
    engagements: latest?.engagements ?? null,
    engagement_rate_reach: latest?.engagement_rate_reach ?? null,
    engagement_rate_views: latest?.engagement_rate_views ?? null,
    save_rate: latest?.save_rate ?? null,
    share_rate: latest?.share_rate ?? null,
    profile_visit_rate: latest?.profile_visit_rate ?? null,
    link_click_rate: latest?.link_click_rate ?? null,
    reach_per_production_hour: latest?.reach_per_production_hour ?? null,
  } as PostKpiRow
})

function idea(id: string, title: string, status: ContentIdeaRow['status'], date: string | null, extra: Partial<ContentIdeaRow> = {}): ContentIdeaRow {
  return {
    id,
    organization_id: DEMO_ORG_ID,
    title,
    status,
    platforms: ['instagram', 'tiktok'],
    theme_id: null,
    format: null,
    target_audience: null,
    hook: null,
    cta: null,
    hypothesis: null,
    production_notes: null,
    planned_production_date: null,
    planned_publish_date: date,
    retrospective: null,
    ai_generated: false,
    initiative_id: null,
    created_by: null,
    created_at: now,
    updated_at: now,
    ...extra,
  }
}

export const demoIdeas: ContentIdeaRow[] = [
  idea('demo-i1', '【サンプル】生徒インタビュー: ゲーム作りで変わったこと', 'idea', null),
  idea('demo-i2', '【サンプル】冬休み体験会の告知', 'planning', '2026-11-25', { hypothesis: '冬休み前は保護者の検討が増えるため、問い合わせにつながりやすい', cta: 'プロフィールから申込' }),
  idea('demo-i3', '【サンプル】AIへの指示のコツ3選', 'production', '2026-11-12', { hypothesis: 'ノウハウ系は保存率が高い' }),
  idea('demo-i4', '【サンプル】中2のレースゲーム完成', 'ready', '2026-11-08'),
  idea('demo-i5', '【サンプル】AIに指示してボスを作るまで', 'analyzed', '2026-10-05', {
    hypothesis: '制作過程を見せると保存率が上がる',
    retrospective: '保存率は他の投稿より高めだったが、まだ1件なので判断できない。同じテーマであと3本試す。',
  }),
]
