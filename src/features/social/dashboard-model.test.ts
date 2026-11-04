import { describe, expect, it } from 'vitest'
import { postKpi } from '@/test/fixtures'
import { analyzablePosts, compareGroups, comparisonLevel, coverage, hourBand } from './dashboard-model'

describe('dashboard-model', () => {
  const rows = [
    postKpi({ post_id: 'a', platform: 'instagram', engagement_rate_reach: 0.1 }),
    postKpi({ post_id: 'b', platform: 'instagram', engagement_rate_reach: 0.3 }),
    postKpi({ post_id: 'c', platform: 'tiktok', engagement_rate_reach: null }), // 計算不能
    postKpi({ post_id: 'd', platform: 'tiktok', snapshot_count: 0, engagement_rate_reach: null }), // 未記録
    postKpi({ post_id: 'e', platform: 'tiktok', status: 'draft' }), // 下書き
  ]

  it('分析対象は公開済み・記録ありの投稿だけ', () => {
    expect(analyzablePosts(rows).map((r) => r.post_id)).toEqual(['a', 'b', 'c'])
  })

  it('グループ比較は計算不能を除外し、件数を併記する', () => {
    const g = compareGroups(rows, 'platform', 'engagement_rate_reach')
    expect(g.find((x) => x.key === 'instagram')).toMatchObject({ n: 2, total: 2, median: 0.2 })
    expect(g.find((x) => x.key === 'tiktok')).toMatchObject({ n: 0, total: 1, median: null, level: 'none' })
    expect(comparisonLevel(g)).toBe('none') // 一方が0件なら比較は未検証
  })

  it('データの状況（件数・期間・欠損）', () => {
    const c = coverage(rows)
    expect(c).toMatchObject({ totalPosts: 5, publishedPosts: 4, recordedPosts: 3, level: 'anecdotal' })
    expect(c.notMeasuredRate.profile_visits).toBe(1)
    expect(c.notMeasuredRate.views).toBe(0)
  })

  it('データがなければ未検証', () => {
    expect(coverage([]).level).toBe('none')
    expect(comparisonLevel([])).toBe('none')
  })

  it('公開時間帯（日本時間）', () => {
    expect(hourBand(7)?.key).toBe('1-morning')
    expect(hourBand(12)?.key).toBe('2-day')
    expect(hourBand(19)?.key).toBe('3-evening')
    expect(hourBand(2)?.key).toBe('4-late')
    expect(hourBand(null)).toBeNull()
  })
})
