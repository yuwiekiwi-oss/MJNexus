import type { SupabaseClient } from '@supabase/supabase-js'
import type { Channel, Stage, Student, StudentInput } from './types'

export interface Repo {
  /** データの保存先の説明（画面に出す） */
  readonly kind: 'supabase' | 'local'
  list(): Promise<Student[]>
  create(input: StudentInput): Promise<void>
  update(id: string, input: StudentInput, statusChanged: boolean): Promise<void>
  remove(id: string): Promise<void>
}

const nowIso = () => new Date().toISOString()

// ---- ブラウザ保存（Supabase 未接続のとき） ----

const KEY = 'mjnexus.students.v1'

export class LocalRepo implements Repo {
  readonly kind = 'local' as const

  private read(): Student[] {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as Student[]) : []
    } catch {
      return []
    }
  }

  private write(list: Student[]) {
    localStorage.setItem(KEY, JSON.stringify(list))
  }

  async list() {
    return this.read()
  }

  async create(input: StudentInput) {
    this.write([...this.read(), { ...input, id: crypto.randomUUID(), statusChangedAt: nowIso() }])
  }

  async update(id: string, input: StudentInput, statusChanged: boolean) {
    this.write(
      this.read().map((s) =>
        s.id === id ? { ...s, ...input, statusChangedAt: statusChanged ? nowIso() : s.statusChangedAt } : s,
      ),
    )
  }

  async remove(id: string) {
    this.write(this.read().filter((s) => s.id !== id))
  }

  async loadSample(today: Date) {
    this.write(sampleStudents(today))
  }
}

// ---- Supabase ----

interface Row {
  id: string
  name: string
  grade: string
  channel: string
  line_added_on: string
  stage: string
  declined: boolean
  status_changed_at: string
}

const fromRow = (r: Row): Student => ({
  id: r.id,
  name: r.name,
  grade: r.grade,
  channel: r.channel as Channel,
  lineAddedOn: r.line_added_on,
  stage: r.stage as Stage,
  declined: r.declined,
  statusChangedAt: r.status_changed_at,
})

const toRow = (s: StudentInput) => ({
  name: s.name,
  grade: s.grade,
  channel: s.channel,
  line_added_on: s.lineAddedOn,
  stage: s.stage,
  declined: s.declined,
})

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const
  constructor(private db: SupabaseClient) {}

  async list() {
    const { data, error } = await this.db.from('students').select('*').order('line_added_on', { ascending: false })
    if (error) throw error
    return (data as Row[]).map(fromRow)
  }

  async create(input: StudentInput) {
    const { error } = await this.db.from('students').insert({ ...toRow(input), status_changed_at: nowIso() })
    if (error) throw error
  }

  async update(id: string, input: StudentInput, statusChanged: boolean) {
    const patch = statusChanged ? { ...toRow(input), status_changed_at: nowIso() } : toRow(input)
    const { error } = await this.db.from('students').update(patch).eq('id', id)
    if (error) throw error
  }

  async remove(id: string) {
    const { error } = await this.db.from('students').delete().eq('id', id)
    if (error) throw error
  }
}

// ---- 動作確認用のサンプル ----

export function sampleStudents(today: Date): Student[] {
  const d = (monthsAgo: number, day: number) => {
    const x = new Date(today.getFullYear(), today.getMonth() - monthsAgo, day)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }
  const rows: [string, string, Channel, string, Stage, boolean][] = [
    ['Aくん', '小5', 'Instagram', d(2, 3), 'enrolled', false],
    ['Bさん', '小4', 'Instagram', d(2, 9), 'attended', true],
    ['Cくん', '中1', '検索', d(2, 15), 'enrolled', false],
    ['Dさん', '小3', 'チラシ・その他', d(2, 22), 'line', true],
    ['Eくん', '小6', '紹介・口コミ', d(1, 2), 'enrolled', false],
    ['Fくん', '小5', 'Instagram', d(1, 8), 'enrolled', false],
    ['Gさん', '小4', '検索', d(1, 14), 'applied', true],
    ['Hくん', '小5', 'Instagram', d(1, 20), 'line', false],
    ['Iくん', '中1', '検索', d(0, 1), 'attended', false],
    ['Jさん', '小6', 'Instagram', d(0, 3), 'applied', false],
  ]
  return rows.map(([name, grade, channel, lineAddedOn, stage, declined], i) => ({
    id: `sample-${i}`,
    name,
    grade,
    channel,
    lineAddedOn: lineAddedOn > d(0, today.getDate()) ? d(0, today.getDate()) : lineAddedOn,
    stage,
    declined,
    statusChangedAt: new Date().toISOString(),
  }))
}
