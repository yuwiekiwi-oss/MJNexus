import { describe, expect, it } from 'vitest'
import { generateTrackingCode, nextIdeaStatus, presetRecordedAt, prevIdeaStatus, toMetricPayload, trackingUrl } from './social'

describe('toMetricPayload', () => {
  it('空欄は未記録として送らない。未取得・非対応は値なしで送る。0は実測として送る', () => {
    const { payload, errors } = toMetricPayload({
      views: { status: 'measured', value: '1,200' },
      likes: { status: 'measured', value: '0' },
      reach: { status: 'measured', value: '' },
      link_clicks: { status: 'unsupported', value: '99' },
      saves: { status: 'not_collected', value: '' },
    })
    expect(errors).toEqual({})
    expect(payload).toEqual([
      { metric: 'views', status: 'measured', value: 1200 },
      { metric: 'likes', status: 'measured', value: 0 },
      { metric: 'saves', status: 'not_collected', value: null },
      { metric: 'link_clicks', status: 'unsupported', value: null },
    ])
  })

  it('負数・小数・文字はエラー', () => {
    const { payload, errors } = toMetricPayload({
      views: { status: 'measured', value: '-1' },
      likes: { status: 'measured', value: '1.5' },
      reach: { status: 'measured', value: 'abc' },
    })
    expect(payload).toEqual([])
    expect(Object.keys(errors).sort()).toEqual(['likes', 'reach', 'views'])
  })
})

describe('presetRecordedAt', () => {
  it('公開日時から24時間後・7日後を計算する', () => {
    expect(presetRecordedAt('2026-11-01T10:00:00Z', 24).toISOString()).toBe('2026-11-02T10:00:00.000Z')
    expect(presetRecordedAt('2026-11-01T10:00:00Z', 168).toISOString()).toBe('2026-11-08T10:00:00.000Z')
  })
  it('不正な日時はエラー', () => {
    expect(() => presetRecordedAt('x', 24)).toThrow()
  })
})

describe('企画ステータス', () => {
  it('Idea → … → Analyzed の順に進む', () => {
    expect(nextIdeaStatus('idea')).toBe('planning')
    expect(nextIdeaStatus('published')).toBe('analyzed')
    expect(nextIdeaStatus('analyzed')).toBeNull()
    expect(prevIdeaStatus('idea')).toBeNull()
    expect(prevIdeaStatus('ready')).toBe('production')
  })
})

describe('追跡リンク', () => {
  it('UTMパラメータを付与する（既存のクエリは保持）', () => {
    const url = new URL(trackingUrl('https://example.com/trial?ref=a', 'tiktok', 'ab12cd'))
    expect(url.searchParams.get('ref')).toBe('a')
    expect(url.searchParams.get('utm_source')).toBe('tiktok')
    expect(url.searchParams.get('utm_medium')).toBe('social')
    expect(url.searchParams.get('utm_content')).toBe('ab12cd')
  })
  it('追跡コードはDBの制約（英小文字・数字4〜16文字）を満たす', () => {
    for (let i = 0; i < 50; i++) expect(generateTrackingCode()).toMatch(/^[a-z0-9]{4,16}$/)
  })
})
