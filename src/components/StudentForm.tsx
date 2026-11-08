import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Repo } from '../lib/repo'
import {
  CHANNELS,
  GRADES,
  STATUS_OPTIONS,
  applyStatus,
  statusLabel,
  statusOf,
  type Channel,
  type Status,
  type Student,
} from '../lib/types'

interface Props {
  student: Student | null
  repo: Repo
  onClose: () => void
  onSaved: () => Promise<void>
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function StudentForm({ student, repo, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(student?.name ?? '')
  const [grade, setGrade] = useState(student?.grade ?? '小5')
  const [channel, setChannel] = useState<Channel | ''>(student?.channel ?? '')
  const [lineAddedOn, setLineAddedOn] = useState(student?.lineAddedOn ?? todayStr())
  const [status, setStatus] = useState<Status>(student ? statusOf(student) : 'line')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!channel) return
    const input = { name: name.trim(), grade, channel, lineAddedOn, ...applyStatus(student, status) }
    void run(() =>
      student ? repo.update(student.id, input, statusOf(student) !== status) : repo.create(input),
    )
  }

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose} aria-labelledby="form-title">
      <form onSubmit={submit} className="form">
        <h2 id="form-title">{student ? '生徒を編集' : '新しく登録'}</h2>
        <label className="field">
          <span>名前（ニックネームでも可）</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>学年</span>
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>LINE追加日</span>
            <input type="date" required value={lineAddedOn} onChange={(e) => setLineAddedOn(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>流入経路</span>
          <select required value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            <option value="" disabled>
              選んでください
            </option>
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <legend>状態</legend>
          <div className="radio-row">
            {STATUS_OPTIONS.map((s) => (
              <label key={s} className={`radio${status === s ? ' radio-on' : ''}`}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                {statusLabel(s)}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="error">保存できませんでした：{error}</p>}
        <div className="form-actions">
          {student && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => {
                if (confirm(`${student.name} を削除しますか？`)) void run(() => repo.remove(student.id))
              }}
            >
              削除
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => dialog.current?.close()} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            保存
          </button>
        </div>
      </form>
    </dialog>
  )
}
