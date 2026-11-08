import { describe, expect, it } from 'vitest'
import { byChannel, byMonth, inPeriod, periodMonths, rate, summary } from './metrics'
import { applyStatus, statusOf, type Student } from './types'

let n = 0
function st(p: Partial<Student>): Student {
  n += 1
  return {
    id: String(n),
    name: `S${n}`,
    grade: '小5',
    channel: 'Instagram',
    lineAddedOn: '2026-10-01',
    stage: 'line',
    declined: false,
    statusChangedAt: '2026-10-01T00:00:00Z',
    ...p,
  }
}

describe('summary', () => {
  it('到達した段で数え、見送りでも到達段までは数える', () => {
    const list = [
      st({ stage: 'line' }),
      st({ stage: 'applied' }),
      st({ stage: 'attended', declined: true }),
      st({ stage: 'enrolled' }),
    ]
    expect(summary(list)).toEqual({
      lineAdded: 4,
      applied: 3,
      attended: 2,
      enrolled: 1,
      trialToEnrollRate: 50,
    })
  })

  it('体験参加が0なら入会率は null', () => {
    expect(summary([st({})]).trialToEnrollRate).toBeNull()
    expect(rate(1, 0)).toBeNull()
  })
})

describe('期間', () => {
  it('直近3か月は今月を含む3か月（年をまたぐ）', () => {
    expect(periodMonths('last3', '2027-01-15', [])).toEqual(['2026-11', '2026-12', '2027-01'])
  })

  it('すべては最初のLINE追加月から', () => {
    const list = [st({ lineAddedOn: '2026-08-20' })]
    expect(periodMonths('all', '2026-10-05', list)).toEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('期間外の生徒は除く', () => {
    const list = [st({ lineAddedOn: '2026-07-31' }), st({ lineAddedOn: '2026-08-01' })]
    expect(inPeriod(list, ['2026-08'])).toHaveLength(1)
  })
})

describe('内訳', () => {
  it('月ごと・経路ごとに集計する', () => {
    const list = [
      st({ lineAddedOn: '2026-09-03', stage: 'enrolled', channel: '検索' }),
      st({ lineAddedOn: '2026-10-03', stage: 'applied' }),
    ]
    expect(byMonth(list, ['2026-09', '2026-10'])).toEqual([
      { month: '2026-09', lineAdded: 1, applied: 1, enrolled: 1 },
      { month: '2026-10', lineAdded: 1, applied: 1, enrolled: 0 },
    ])
    const ch = byChannel(list)
    expect(ch.find((c) => c.channel === '検索')?.funnel.counts).toEqual([1, 1, 1, 1])
    expect(ch.find((c) => c.channel === 'Instagram')?.funnel.counts).toEqual([1, 1, 0, 0])
    expect(ch.find((c) => c.channel === '紹介・口コミ')?.funnel.counts).toEqual([0, 0, 0, 0])
  })
})

describe('状態の変換', () => {
  it('見送りにすると到達段を残す', () => {
    expect(applyStatus({ stage: 'attended' }, 'declined')).toEqual({ stage: 'attended', declined: true })
    expect(applyStatus(null, 'declined')).toEqual({ stage: 'line', declined: true })
    expect(applyStatus({ stage: 'attended' }, 'enrolled')).toEqual({ stage: 'enrolled', declined: false })
    expect(statusOf({ stage: 'attended', declined: true })).toBe('declined')
  })
})
