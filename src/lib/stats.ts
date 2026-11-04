/**
 * 記述統計（グループ比較用）。
 * ここでは「数える・並べる」だけを行い、有意差などの推測統計は Python 側（Phase 4）で行う。
 * サンプル数の基準は analytics/mj_analytics/data_quality.py と同じ。
 */

export type SampleLevel = 'none' | 'anecdotal' | 'descriptive' | 'inferential'

export const SAMPLE_LEVEL_LABEL: Record<SampleLevel, string> = {
  none: '未検証（データなし）',
  anecdotal: '事例レベル（n<10）',
  descriptive: '記述統計レベル（n<30）',
  inferential: '比較可能（n≥30）',
}

export function sampleSizeLevel(n: number): SampleLevel {
  if (!Number.isInteger(n) || n < 0) throw new Error('n must be a non-negative integer')
  if (n === 0) return 'none'
  if (n <= 9) return 'anecdotal'
  if (n <= 29) return 'descriptive'
  return 'inferential'
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? ((s[mid - 1] as number) + (s[mid] as number)) / 2 : (s[mid] as number)
}

export interface GroupSummary {
  key: string
  label: string
  /** グループ内の投稿数（指標が計算不能な投稿を含む） */
  total: number
  /** 指標が計算できた投稿数（= 統計の n） */
  n: number
  median: number | null
  mean: number | null
  min: number | null
  max: number | null
  level: SampleLevel
}

/**
 * rows をグループに分け、value が null でない行だけで統計を出す。
 * 計算不能（null）を 0 として扱わない。
 */
export function summarizeByGroup<T>(
  rows: readonly T[],
  groupOf: (row: T) => { key: string; label: string } | null,
  valueOf: (row: T) => number | null | undefined,
): GroupSummary[] {
  const groups = new Map<string, { label: string; total: number; values: number[] }>()
  for (const row of rows) {
    const g = groupOf(row)
    if (!g) continue
    const entry = groups.get(g.key) ?? { label: g.label, total: 0, values: [] }
    entry.total++
    const v = valueOf(row)
    if (v !== null && v !== undefined && Number.isFinite(v)) entry.values.push(v)
    groups.set(g.key, entry)
  }
  return [...groups.entries()]
    .map(([key, { label, total, values }]) => ({
      key,
      label,
      total,
      n: values.length,
      median: median(values),
      mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      level: sampleSizeLevel(values.length),
    }))
    .sort((a, b) => (b.median ?? -Infinity) - (a.median ?? -Infinity))
}
