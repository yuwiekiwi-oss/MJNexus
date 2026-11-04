/**
 * データ量の目安（件数が少ないときに結論を出さないための表示用）。
 * 有意差などの推測統計は行わない。サンプル数の基準は analytics/mj_analytics/data_quality.py と同じ。
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
