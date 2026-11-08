import { useState } from 'react'
import type { StudentsState } from '../App'
import StudentForm from '../components/StudentForm'
import { CHANNEL_COLORS } from './Dashboard'
import { STAGE_LABELS, STATUS_OPTIONS, statusLabel, statusOf, type Status, type Student } from '../lib/types'

const STATUS_STYLE: Record<Status, { bg: string; fg: string }> = {
  line: { bg: '#F4F4F5', fg: '#3F3F46' },
  applied: { bg: '#DBEAFE', fg: '#1E3A8A' },
  attended: { bg: '#FEF3C7', fg: '#78350F' },
  enrolled: { bg: '#DCFCE7', fg: '#14532D' },
  declined: { bg: '#FEE2E2', fg: '#991B1B' },
}

function formatDate(d: string) {
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
}

export default function Ledger({ students, loading, repo, reload }: StudentsState) {
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [editing, setEditing] = useState<Student | 'new' | null>(null)

  const sorted = [...students].sort((a, b) => b.lineAddedOn.localeCompare(a.lineAddedOn))
  const rows = filter === 'all' ? sorted : sorted.filter((s) => statusOf(s) === filter)
  const filters: { key: Status | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'すべて', count: students.length },
    ...STATUS_OPTIONS.map((k) => ({
      key: k,
      label: statusLabel(k),
      count: students.filter((s) => statusOf(s) === k).length,
    })),
  ]

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>体験・入会台帳</h1>
          <p className="muted">状態を変えるだけで、ダッシュボードの数字が自動で更新されます。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          ＋ 新しく登録
        </button>
      </div>

      <div className="chips" role="group" aria-label="状態で絞り込み">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip${filter === f.key ? ' chip-on' : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}　{f.count}
          </button>
        ))}
      </div>

      <section className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>生徒</th>
                <th>流入経路</th>
                <th>LINE追加日</th>
                <th>状態</th>
                <th>
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const status = statusOf(s)
                const style = STATUS_STYLE[status]
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <span className="muted grade">{s.grade}</span>
                    </td>
                    <td>
                      <span className="swatch" style={{ background: CHANNEL_COLORS[s.channel].color }} />
                      {s.channel}
                    </td>
                    <td>{formatDate(s.lineAddedOn)}</td>
                    <td>
                      <span className="status" style={{ background: style.bg, color: style.fg }}>
                        {statusLabel(status)}
                      </span>
                      {s.declined && s.stage !== 'line' && (
                        <span className="muted small"> （{STAGE_LABELS[s.stage]}の後）</span>
                      )}
                    </td>
                    <td className="cell-action">
                      <button type="button" className="btn btn-small" onClick={() => setEditing(s)}>
                        編集
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted empty-row">
                    該当する生徒はいません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <StudentForm
          student={editing === 'new' ? null : editing}
          repo={repo}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await reload()
          }}
        />
      )}
    </div>
  )
}
