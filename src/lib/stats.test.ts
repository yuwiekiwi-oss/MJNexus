import { describe, expect, it } from 'vitest'
import { median, sampleSizeLevel } from './stats'

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
