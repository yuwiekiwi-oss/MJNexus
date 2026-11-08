import { CHANNELS, STAGES, type Channel, type Stage, type Student } from './types'

export type PeriodKey = 'thisMonth' | 'last3' | 'last6' | 'all'

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'thisMonth', label: '今月' },
  { key: 'last3', label: '直近3か月' },
  { key: 'last6', label: '直近6か月' },
  { key: 'all', label: 'すべて' },
]

/** 'YYYY-MM' */
export function monthKey(date: string): string {
  return date.slice(0, 7)
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 期間に含まれる月の一覧（古い順）。'all' はデータのある最初の月から。 */
export function periodMonths(period: PeriodKey, today: string, students: Student[]): string[] {
  const end = monthKey(today)
  let start: string
  if (period === 'thisMonth') start = end
  else if (period === 'last3') start = shiftMonth(end, -2)
  else if (period === 'last6') start = shiftMonth(end, -5)
  else {
    const first = students.map((s) => monthKey(s.lineAddedOn)).sort()[0]
    start = first && first < end ? first : end
  }
  const months: string[] = []
  for (let m = start; m <= end; m = shiftMonth(m, 1)) months.push(m)
  return months
}

export function inPeriod(students: Student[], months: string[]): Student[] {
  const set = new Set(months)
  return students.filter((s) => set.has(monthKey(s.lineAddedOn)))
}

const idx = (stage: Stage) => STAGES.indexOf(stage)

/** その段まで進んだ人数（見送りでも、到達した段までは数える） */
export function reached(students: Student[], stage: Stage): number {
  return students.filter((s) => idx(s.stage) >= idx(stage)).length
}

/** 割合（0〜100）。分母が0なら null */
export function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : (numerator / denominator) * 100
}

export function formatRate(r: number | null): string {
  return r === null ? '—' : `${Math.round(r)}%`
}

export interface Funnel {
  counts: [number, number, number, number]
}

export function funnel(students: Student[]): Funnel {
  return { counts: STAGES.map((st) => reached(students, st)) as Funnel['counts'] }
}

export interface Summary {
  enrolled: number
  lineAdded: number
  applied: number
  attended: number
  trialToEnrollRate: number | null
}

export function summary(students: Student[]): Summary {
  const [lineAdded, applied, attended, enrolled] = funnel(students).counts
  return { enrolled, lineAdded, applied, attended, trialToEnrollRate: rate(enrolled, attended) }
}

export interface MonthRow {
  month: string
  lineAdded: number
  applied: number
  enrolled: number
}

/** LINE追加月ごとの内訳 */
export function byMonth(students: Student[], months: string[]): MonthRow[] {
  return months.map((month) => {
    const group = students.filter((s) => monthKey(s.lineAddedOn) === month)
    const [lineAdded, applied, , enrolled] = funnel(group).counts
    return { month, lineAdded, applied, enrolled }
  })
}

export function byChannel(students: Student[]): { channel: Channel; funnel: Funnel }[] {
  return CHANNELS.map((channel) => ({
    channel,
    funnel: funnel(students.filter((s) => s.channel === channel)),
  }))
}

export function monthLabel(ym: string): string {
  return `${Number(ym.slice(5, 7))}月`
}
