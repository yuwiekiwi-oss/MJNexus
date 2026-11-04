import { describe, expect, it } from 'vitest'
import { postKpi } from '@/test/fixtures'
import { metricCell, parseMetricsCsv, postsToCsv } from './csv'

const posts = new Map([
  ['https://www.instagram.com/p/a/', { id: 'post-a', publishedAt: '2026-11-01T10:00:00Z' }],
  ['https://www.tiktok.com/@x/video/1', { id: 'post-b', publishedAt: null }],
])
const now = new Date('2026-11-10T00:00:00Z')

describe('parseMetricsCsv', () => {
  it('数値・空欄・未取得・非対応を区別して読み込む', () => {
    const csv =
      'post_url,recorded_at,views,likes,saves,link_clicks,note\n' +
      'https://www.instagram.com/p/a/,2026-11-02T10:00:00Z,"1,200",0,未取得,非対応,24h\n'
    const { rows, errors } = parseMetricsCsv(csv, posts, now)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ postId: 'post-a', recordedAt: '2026-11-02T10:00:00.000Z', note: '24h' })
    expect(rows[0]?.values).toEqual([
      { metric: 'views', status: 'measured', value: 1200 },
      { metric: 'likes', status: 'measured', value: 0 },
      { metric: 'saves', status: 'not_collected', value: null },
      { metric: 'link_clicks', status: 'unsupported', value: null },
    ])
  })

  it('行ごとのエラーを行番号付きで返し、正しい行だけを取り込み対象にする', () => {
    const csv =
      'post_url,recorded_at,views\n' +
      'https://unknown.example/,2026-11-02T10:00:00Z,1\n' + // 2: 未登録URL
      'https://www.instagram.com/p/a/,not-a-date,1\n' + // 3: 日時不正
      'https://www.instagram.com/p/a/,2026-10-01T00:00:00Z,1\n' + // 4: 公開前
      'https://www.instagram.com/p/a/,2026-12-01T00:00:00Z,1\n' + // 5: 未来
      'https://www.instagram.com/p/a/,2026-11-03T10:00:00Z,-5\n' + // 6: 負数
      'https://www.instagram.com/p/a/,2026-11-03T10:00:00Z,\n' + // 7: 値なし
      'https://www.tiktok.com/@x/video/1,2026-11-03T10:00:00Z,10\n' + // 8: OK
      'https://www.tiktok.com/@x/video/1,2026-11-03T10:00:00Z,11\n' // 9: 重複
    const { rows, errors } = parseMetricsCsv(csv, posts, now)
    expect(rows.map((r) => r.line)).toEqual([8])
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7, 9])
  })

  it('ヘッダーの不足はファイル全体のエラー', () => {
    const { rows, errors } = parseMetricsCsv('views\n1\n', posts, now)
    expect(rows).toEqual([])
    expect(errors[0]?.message).toContain('post_url')
  })

  it('エクスポートで無害化したURLを再取り込みできる', () => {
    const map = new Map([['=cmd', { id: 'x', publishedAt: null }]])
    const { rows } = parseMetricsCsv("post_url,recorded_at,views\n'=cmd,2026-11-02T10:00:00Z,1\n", map, now)
    expect(rows).toHaveLength(1)
  })
})

describe('postsToCsv', () => {
  it('未取得・非対応は文字、未記録は空欄、実測0は0で出力し、式を無害化する', () => {
    const csv = postsToCsv([postKpi({ title: '=HYPERLINK("x")' })])
    const [header, line] = csv.replace(/^﻿/, '').trim().split('\r\n')
    const cols = header!.split(',')
    const cells = line!.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, ''))
    const get = (k: string) => cells[cols.indexOf(k)]
    expect(get('title')).toBe('"\'=HYPERLINK(""x"")"')
    expect(get('comments')).toBe('0')
    expect(get('profile_visits')).toBe('未取得')
    expect(get('follows_gained')).toBe('非対応')
    expect(get('link_clicks')).toBe('')
  })

  it('metricCell', () => {
    expect(metricCell(0, 'measured')).toBe(0)
    expect(metricCell(null, null)).toBe('')
  })
})
