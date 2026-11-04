import { describe, expect, it } from 'vitest'
import { formatMetric, fromRow, safeRate } from './metrics'

describe('fromRow', () => {
  it('行がなければ未記録', () => {
    expect(fromRow(undefined)).toEqual({ status: 'not_recorded' })
  })
  it('実測0は0として保持する', () => {
    expect(fromRow({ status: 'measured', value: 0 })).toEqual({ status: 'measured', value: 0 })
  })
  it('未取得・非対応は値を持たない', () => {
    expect(fromRow({ status: 'not_collected', value: null })).toEqual({ status: 'not_collected' })
    expect(fromRow({ status: 'unsupported', value: null })).toEqual({ status: 'unsupported' })
  })
  it('実測なのに値がない・負の値は不正', () => {
    expect(() => fromRow({ status: 'measured', value: null })).toThrow()
    expect(() => fromRow({ status: 'measured', value: -1 })).toThrow()
  })
})

describe('formatMetric', () => {
  it('状態ごとに表示を分ける', () => {
    expect(formatMetric({ status: 'measured', value: 12345 })).toBe('12,345')
    expect(formatMetric({ status: 'measured', value: 0 })).toBe('0')
    expect(formatMetric({ status: 'not_collected' })).toBe('未取得')
    expect(formatMetric({ status: 'unsupported' })).toBe('非対応')
    expect(formatMetric({ status: 'not_recorded' })).toBe('未記録')
  })
})

describe('safeRate', () => {
  const m = (value: number) => ({ status: 'measured' as const, value })
  it('分子/分母を計算する', () => {
    expect(safeRate(m(5), m(100))).toBe(0.05)
    expect(safeRate(m(0), m(100))).toBe(0)
  })
  it('分母0・未取得・非対応は計算不能（null）で、0%と区別する', () => {
    expect(safeRate(m(5), m(0))).toBeNull()
    expect(safeRate({ status: 'not_collected' }, m(100))).toBeNull()
    expect(safeRate(m(5), { status: 'unsupported' })).toBeNull()
    expect(safeRate(m(5), { status: 'not_recorded' })).toBeNull()
  })
})
