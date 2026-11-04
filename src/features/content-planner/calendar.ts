/** カレンダー表示用の日付計算（日本時間・月曜始まり） */

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** その月を含む、月曜始まりの週の日付（6週 × 7日 = 42日） */
export function monthGrid(year: number, month0: number): { key: string; inMonth: boolean; day: number }[] {
  const first = new Date(year, month0, 1)
  const offset = (first.getDay() + 6) % 7 // 月曜=0
  const start = new Date(year, month0, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { key: toDateKey(d), inMonth: d.getMonth() === month0, day: d.getDate() }
  })
}

/** ISO日時 → 日本時間の日付キー */
export function jstDateKey(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date(iso))
}
