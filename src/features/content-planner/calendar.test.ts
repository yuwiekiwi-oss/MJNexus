import { describe, expect, it } from 'vitest'
import { jstDateKey, monthGrid } from './calendar'

describe('calendar', () => {
  it('月曜始まりの6週グリッド', () => {
    const g = monthGrid(2026, 10) // 2026年11月（1日は日曜）
    expect(g).toHaveLength(42)
    expect(g[0]).toEqual({ key: '2026-10-26', inMonth: false, day: 26 })
    expect(g[6]).toEqual({ key: '2026-11-01', inMonth: true, day: 1 })
  })
  it('UTCの日時を日本時間の日付にする', () => {
    expect(jstDateKey('2026-11-01T16:00:00Z')).toBe('2026-11-02')
  })
})
