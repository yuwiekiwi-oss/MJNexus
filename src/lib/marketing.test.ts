import { describe, expect, it } from 'vitest'
import {
  costState,
  type FunnelRow,
  funnelRates,
  gradeLabel,
  isImmatureCohort,
  looksLikePii,
  parseLanding,
  presetPeriod,
  todayJst,
} from './marketing'

function row(o: Partial<FunnelRow> = {}): FunnelRow {
  return {
    group_key: 'all',
    group_label: '全体',
    inquiries: 4,
    tracked_inquiries: 1,
    trial_booked: 3,
    trial_attended: 2,
    enrolled: 2,
    closed_lost: 1,
    open_recent: 0,
    median_days_to_enroll: 12,
    cost_jpy: 8000,
    cost_visible: true,
    ...o,
  }
}

describe('funnelRates', () => {
  it('件数から率・単価を計算する（DBテストと同じシナリオ）', () => {
    const r = funnelRates(row())
    expect(r.trialBookingRate).toBe(0.75)
    expect(r.trialAttendanceRate).toBeCloseTo(2 / 3)
    expect(r.trialToEnrollment).toBe(1)
    expect(r.inquiryToEnrollment).toBe(0.5)
    expect(r.cpa).toBe(2000)
    expect(r.cac).toBe(4000)
  })

  it('分母0は計算不能（0%にしない）', () => {
    const r = funnelRates(row({ inquiries: 0, trial_booked: 0, trial_attended: 0, enrolled: 0 }))
    expect(r.trialBookingRate).toBeNull()
    expect(r.cac).toBeNull()
  })

  it('費用が未記録・権限なしなら CPA/CAC は計算不能（費用0円とみなさない）', () => {
    expect(funnelRates(row({ cost_jpy: null })).cpa).toBeNull()
    expect(funnelRates(row({ cost_visible: false, cost_jpy: null })).cac).toBeNull()
    expect(costState(row({ cost_jpy: null }), 'channel')).toBe('not_recorded')
    expect(costState(row({ cost_visible: false, cost_jpy: null }), 'total')).toBe('no_permission')
    expect(costState(row(), 'attribution')).toBe('not_applicable')
  })
})

describe('流入URL', () => {
  it('追跡リンクのURLからUTMを取り出す', () => {
    expect(parseLanding('https://mj.example/?utm_source=instagram&utm_medium=social&utm_content=AB12cd')).toEqual({
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: null,
      utm_content: 'ab12cd',
    })
    expect(parseLanding('?utm_campaign=winter')?.utm_campaign).toBe('winter')
    expect(parseLanding('https://mj.example/')).toBeNull()
    expect(parseLanding('')).toBeNull()
  })

})

describe('その他', () => {
  it('学年の表示', () => {
    expect(gradeLabel(4)).toBe('小4')
    expect(gradeLabel(7)).toBe('中1')
    expect(gradeLabel(null)).toBe('—')
  })

  it('メモに連絡先らしき文字列があれば警告する', () => {
    expect(looksLikePii('連絡は parent@example.com へ')).toBe(true)
    expect(looksLikePii('090-1234-5678')).toBe(true)
    expect(looksLikePii('09012345678')).toBe(true)
    expect(looksLikePii('2026-09-15に体験。Robloxに興味')).toBe(false)
  })

  it('直近30日以内に終わる期間は未成熟', () => {
    expect(isImmatureCohort('2026-11-01', '2026-11-04')).toBe(true)
    expect(isImmatureCohort('2026-09-30', '2026-11-04')).toBe(false)
  })

  it('期間プリセット（日本時間）', () => {
    expect(presetPeriod('last_month', '2026-01-15')).toEqual(['2025-12-01', '2025-12-31'])
    expect(presetPeriod('last_3_months', '2026-11-04')).toEqual(['2026-09-01', '2026-11-04'])
    expect(todayJst(new Date('2026-11-04T16:00:00Z'))).toBe('2026-11-05')
  })
})
