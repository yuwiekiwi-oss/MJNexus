import { formatMetric, fromRow, type MetricStatus } from '@/lib/metrics'

export function metricText(value: number | null, status: MetricStatus | null): string {
  return formatMetric(fromRow(status ? { status, value } : null))
}

export function percentText(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${(Number(v) * 100).toFixed(1)}%`
}

const dtf = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
export function dateTimeText(iso: string | null | undefined): string {
  return iso ? dtf.format(new Date(iso)) : '—'
}

/** <input type="datetime-local"> 用（日本時間） */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return jst.toISOString().slice(0, 16)
}
/** datetime-local（日本時間として解釈）→ ISO */
export function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(`${v}:00+09:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
