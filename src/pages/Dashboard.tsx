import { useMemo, useState } from 'react'
import type { StudentsState } from '../App'
import {
  PERIODS,
  byChannel,
  byMonth,
  formatRate,
  inPeriod,
  monthLabel,
  periodMonths,
  rate,
  summary,
  type PeriodKey,
} from '../lib/metrics'
import { STAGE_LABELS, STAGES, type Channel } from '../lib/types'
import { LocalRepo } from '../lib/repo'

export const CHANNEL_COLORS: Record<Channel, { color: string; tint: string }> = {
  Instagram: { color: '#BE185D', tint: '#FCE7F3' },
  検索: { color: '#1D4ED8', tint: '#DBEAFE' },
  '紹介・口コミ': { color: '#B45309', tint: '#FEF3C7' },
  'チラシ・その他': { color: '#52525B', tint: '#F4F4F5' },
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard({ students, loading, repo, reload }: StudentsState) {
  const [period, setPeriod] = useState<PeriodKey>('last3')
  const months = useMemo(() => periodMonths(period, today(), students), [period, students])
  const list = useMemo(() => inPeriod(students, months), [students, months])
  const s = summary(list)
  const monthly = byMonth(list, months)
  const channels = byChannel(list)
  const breakdown = (pick: (r: (typeof monthly)[number]) => number) =>
    months.length > 1 ? monthly.map((r) => `${monthLabel(r.month)} ${pick(r)}人`).join('・') : ''

  const kpis = [
    { label: '入会者数', value: String(s.enrolled), unit: '人', note: breakdown((r) => r.enrolled), main: true },
    { label: 'LINE追加数', value: String(s.lineAdded), unit: '人', note: breakdown((r) => r.lineAdded) },
    { label: '体験申込数', value: String(s.applied), unit: '人', note: breakdown((r) => r.applied) },
    {
      label: '体験 → 入会率',
      value: s.trialToEnrollRate === null ? '—' : String(Math.round(s.trialToEnrollRate)),
      unit: s.trialToEnrollRate === null ? '' : '%',
      note: `体験に来た${s.attended}人のうち${s.enrolled}人`,
    },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <h1>ダッシュボード</h1>
        <label className="period">
          <span className="sr-only">期間</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)}>
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!loading && students.length === 0 && (
        <div className="card empty">
          <p>まだ生徒が登録されていません。「体験・入会台帳」から登録すると、ここに数字が出ます。</p>
          {repo instanceof LocalRepo && (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await repo.loadSample(new Date())
                await reload()
              }}
            >
              サンプルデータで試す
            </button>
          )}
        </div>
      )}

      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`card kpi${k.main ? ' kpi-main' : ''}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">
              {k.value}
              <span>{k.unit}</span>
            </div>
            <div className="muted small">{k.note}</div>
          </div>
        ))}
      </div>

      <section className="card">
        <h2>流入経路ごとの LINE追加 → 体験申込 → 体験参加 → 入会</h2>
        <p className="muted small">LINE追加月で集計しています。段の下の％は、前の段から次へ進んだ割合です。</p>
        <div className="funnels">
          {channels.map(({ channel, funnel }) => {
            const { color, tint } = CHANNEL_COLORS[channel]
            const [first, , , last] = funnel.counts
            return (
              <div key={channel} className="funnel">
                <div className="funnel-head">
                  <h3>
                    <span className="swatch" style={{ background: color }} />
                    {channel}
                  </h3>
                  <span className="pill" style={{ color, background: tint }}>
                    入会率 {formatRate(rate(last, first))}
                  </span>
                </div>
                <div className="bars">
                  {funnel.counts.map((n, i) => (
                    <div key={STAGES[i]} className="bar-col">
                      <div className="bar-num">
                        {n}
                        <small>人</small>
                      </div>
                      <div
                        className="bar"
                        style={{
                          height: `${first ? Math.max(3, (n / first) * 100) : 3}px`,
                          background: color,
                          opacity: 1 - i * 0.15,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="bar-labels">
                  {funnel.counts.map((n, i) => (
                    <div key={STAGES[i]}>
                      <div className="muted">{STAGE_LABELS[STAGES[i]].replace('のみ', '')}</div>
                      <strong>{i === 0 ? '　' : formatRate(rate(n, funnel.counts[i - 1]))}</strong>
                    </div>
                  ))}
                </div>
                <div className="muted small">
                  LINE追加{first}人のうち {last}人が入会
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
