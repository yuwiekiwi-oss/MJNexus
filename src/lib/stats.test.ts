import { describe, expect, it } from 'vitest'
import { median, sampleSizeLevel, summarizeByGroup } from './stats'

describe('median', () => {
  it('奇数・偶数・空', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('sampleSizeLevel（Python版と同じ閾値）', () => {
  it.each([
    [0, 'none'],
    [1, 'anecdotal'],
    [9, 'anecdotal'],
    [10, 'descriptive'],
    [29, 'descriptive'],
    [30, 'inferential'],
  ] as const)('n=%i → %s', (n, level) => {
    expect(sampleSizeLevel(n)).toBe(level)
  })
  it('負数はエラー', () => expect(() => sampleSizeLevel(-1)).toThrow())
})

describe('summarizeByGroup', () => {
  it('計算不能（null）を0として扱わず、n と total を分けて数える', () => {
    const rows = [
      { g: 'A', v: 0.1 },
      { g: 'A', v: null },
      { g: 'A', v: 0.3 },
      { g: 'B', v: null },
    ]
    const out = summarizeByGroup(rows, (r) => ({ key: r.g, label: r.g }), (r) => r.v)
    const a = out.find((x) => x.key === 'A')!
    const b = out.find((x) => x.key === 'B')!
    expect(a).toMatchObject({ total: 3, n: 2, median: 0.2, min: 0.1, max: 0.3, level: 'anecdotal' })
    expect(b).toMatchObject({ total: 1, n: 0, median: null, level: 'none' })
    expect(out[0]?.key).toBe('A') // 中央値の大きい順、計算不能は最後
  })
})
