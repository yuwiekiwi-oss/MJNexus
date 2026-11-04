import { Filter, Info, Lock, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DomainBadge, SampleLevelBadge } from '@/components/analysis-badges'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useOrgContext } from '@/features/organization/use-org-context'
import { formatKpiValue } from '@/lib/kpi-catalog'
import {
  ATTRIBUTION_LABEL,
  type AttributionMethod,
  COST_STATE_LABEL,
  costState,
  FUNNEL_GROUP_LABEL,
  FUNNEL_GROUPS,
  type FunnelGroup,
  type FunnelRow,
  funnelRates,
  isImmatureCohort,
  PERIOD_PRESET_LABEL,
  type PeriodPreset,
  presetPeriod,
  todayJst,
} from '@/lib/marketing'
import { sampleSizeLevel } from '@/lib/stats'
import { useFunnel } from './api'

const pct = (v: number | null) => formatKpiValue('percent', v)
const jpy = (v: number | null) => formatKpiValue('jpy', v)

function groupLabel(group: FunnelGroup, row: FunnelRow): string {
  if (group === 'attribution') return ATTRIBUTION_LABEL[row.group_key as AttributionMethod] ?? row.group_key
  return row.group_label ?? row.group_key
}

function costCell(row: FunnelRow, group: FunnelGroup, value: number | null) {
  const state = costState(row, group)
  if (state !== 'recorded') return <span className="text-muted-foreground">{COST_STATE_LABEL[state]}</span>
  return value === null ? <span className="text-muted-foreground">計算不能</span> : jpy(value)
}

/** 全体の段階別の件数（横棒）。率は前の段階を分母にしてラベルに出す */
function StageChart({ row }: { row: FunnelRow }) {
  const r = funnelRates(row)
  const data = [
    { stage: '問い合わせ', n: row.inquiries, note: '' },
    { stage: '体験申込', n: row.trial_booked, note: pct(r.trialBookingRate) },
    { stage: '体験参加', n: row.trial_attended, note: pct(r.trialAttendanceRate) },
    { stage: '入会', n: row.enrolled, note: pct(r.trialToEnrollment) },
  ]
  return (
    <div className="h-52 w-full" role="img" aria-label={`集客ファネル: 問い合わせ${row.inquiries}件、体験申込${row.trial_booked}件、体験参加${row.trial_attended}件、入会${row.enrolled}件`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 96, bottom: 4, left: 8 }} barCategoryGap={10}>
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} stroke="var(--border)" />
          <YAxis type="category" dataKey="stage" width={80} tick={{ fill: 'var(--foreground)', fontSize: 12 }} stroke="var(--border)" interval={0} />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)' }}
            formatter={(v, _n, item) => {
              const note = (item.payload as { note: string }).note
              return [`${v}件${note ? `（前の段階の ${note}）` : ''}`, '件数']
            }}
          />
          <Bar dataKey="n" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
            <LabelList
              dataKey="n"
              position="right"
              content={(p) => {
                const { x, y, width, height, index } = p as { x: number; y: number; width: number; height: number; index: number }
                const d = data[index]!
                return (
                  <text x={x + width + 6} y={y + height / 2} dy={4} fill="var(--muted-foreground)" fontSize={12}>
                    {d.n}件{d.note && ` ・ ${d.note}`}
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FunnelPanel() {
  const { role } = useOrgContext()
  const [today] = useState(() => todayJst())
  const [preset, setPreset] = useState<PeriodPreset | 'custom'>('last_3_months')
  const [range, setRange] = useState<[string, string]>(() => presetPeriod('last_3_months', today))
  const [group, setGroup] = useState<FunnelGroup>('total')
  const [from, to] = range
  const funnel = useFunnel(from, to, group)
  const total = useFunnel(from, to, 'total')

  if (role === 'viewer') {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="集客ファネルは編集者以上が閲覧できます"
        description="入会の情報（生徒の情報）を含むため、閲覧者には表示しません。閲覧者には入会が0件と誤って見えないよう、集計そのものを表示しません。"
      />
    )
  }

  const totalRow = total.data?.[0]
  const n = totalRow?.inquiries ?? 0
  const immature = isImmatureCohort(to, today)
  const groupLevel = funnel.data && funnel.data.length > 0 ? sampleSizeLevel(Math.min(...funnel.data.map((r) => r.inquiries))) : 'none'

  return (
    <div className="space-y-6">
      <Alert role="note">
        <Info />
        <AlertTitle className="flex flex-wrap items-center gap-2">
          ここは経営分析です <DomainBadge domain="business" />
        </AlertTitle>
        <AlertDescription>
          記録した問い合わせ・体験・入会・集客費用を数えています。率は「期間内に問い合わせた人のうち、その後に体験・入会した人」で計算します（問い合わせ月コホート）。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="期間（問い合わせ日）" htmlFor="funnel-preset" className="w-40">
              <NativeSelect
                id="funnel-preset"
                value={preset}
                onChange={(e) => {
                  const p = e.target.value as PeriodPreset | 'custom'
                  setPreset(p)
                  if (p !== 'custom') setRange(presetPeriod(p, today))
                }}
              >
                {(Object.keys(PERIOD_PRESET_LABEL) as PeriodPreset[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_PRESET_LABEL[p]}
                  </option>
                ))}
                <option value="custom">期間を指定</option>
              </NativeSelect>
            </Field>
            {preset === 'custom' && (
              <>
                <Field label="開始日" htmlFor="funnel-from" className="w-40">
                  <Input id="funnel-from" type="date" value={from} max={to} onChange={(e) => setRange([e.target.value, to])} />
                </Field>
                <Field label="終了日" htmlFor="funnel-to" className="w-40">
                  <Input id="funnel-to" type="date" value={to} min={from} onChange={(e) => setRange([from, e.target.value])} />
                </Field>
              </>
            )}
            <Field label="切り口" htmlFor="funnel-group" className="w-52">
              <NativeSelect id="funnel-group" value={group} onChange={(e) => setGroup(e.target.value as FunnelGroup)}>
                {FUNNEL_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {FUNNEL_GROUP_LABEL[g]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-2">
            {from} 〜 {to} の問い合わせ {n} 件 <SampleLevelBadge level={sampleSizeLevel(n)} />
            {totalRow && n > 0 && <span>うち追跡リンク経由 {totalRow.tracked_inquiries} 件</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {immature && n > 0 && (
            <Alert role="note">
              <TriangleAlert />
              <AlertDescription>
                期間に直近30日以内の問い合わせを含みます。まだ体験・入会を検討中の人がいるため、率は今後上がる可能性があります（成熟していない期間）。
                {totalRow && totalRow.open_recent > 0 && ` 直近30日の検討中: ${totalRow.open_recent} 件。`}
              </AlertDescription>
            </Alert>
          )}
          {total.isPending ? (
            <LoadingState rows={3} />
          ) : total.isError ? (
            <ErrorState description={total.error.message} onRetry={() => void total.refetch()} />
          ) : !totalRow || n === 0 ? (
            <EmptyState
              icon={<Filter className="size-5" />}
              title="未検証：この期間の問い合わせがありません"
              description="問い合わせを登録すると、体験・入会までの流れがここに表示されます。架空の数値は表示しません。"
            />
          ) : (
            <>
              <StageChart row={totalRow} />
              <p className="text-xs text-muted-foreground">
                ％は一つ前の段階に対する割合です（体験申込率 = 体験申込 ÷ 問い合わせ、体験参加率 = 体験参加 ÷ 体験申込、入会 = 入会 ÷ 体験参加）。
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {n > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {FUNNEL_GROUP_LABEL[group]}の成果 {group !== 'total' && <SampleLevelBadge level={groupLevel} />}
            </CardTitle>
            <CardDescription>
              CPA = 集客費用 ÷ 問い合わせ数、CAC = 集客費用 ÷ 入会数（費用は広告費・キャンペーン費・制作外注費。人件費は含めません）。費用が記録されていない場合は0円とみなさず「費用未記録」と表示します。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {group === 'attribution' && (
              <Alert role="note">
                <Info />
                <AlertDescription>
                  きっかけの記録は確度が異なります。「追跡リンク」以外（本人の回答・スタッフの推定）は参考値です。
                </AlertDescription>
              </Alert>
            )}
            {funnel.isPending ? (
              <LoadingState rows={3} />
            ) : funnel.isError ? (
              <ErrorState description={funnel.error.message} onRetry={() => void funnel.refetch()} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm tabular-nums">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">グループ</th>
                      <th className="py-2 pr-3 text-right font-medium">問い合わせ</th>
                      <th className="py-2 pr-3 text-right font-medium">体験申込（率）</th>
                      <th className="py-2 pr-3 text-right font-medium">体験参加（率）</th>
                      <th className="py-2 pr-3 text-right font-medium">入会（問い合わせ比）</th>
                      <th className="py-2 pr-3 text-right font-medium">失注</th>
                      <th className="py-2 pr-3 text-right font-medium">入会までの日数</th>
                      <th className="py-2 pr-3 text-right font-medium">費用</th>
                      <th className="py-2 pr-3 text-right font-medium">CPA</th>
                      <th className="py-2 text-right font-medium">CAC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.data.map((row) => {
                      const r = funnelRates(row)
                      return (
                        <tr key={row.group_key} className="border-b last:border-0">
                          <td className="py-2 pr-3">{groupLabel(group, row)}</td>
                          <td className="py-2 pr-3 text-right">{row.inquiries}</td>
                          <td className="py-2 pr-3 text-right">
                            {row.trial_booked} <span className="text-muted-foreground">（{pct(r.trialBookingRate)}）</span>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {row.trial_attended} <span className="text-muted-foreground">（{pct(r.trialAttendanceRate)}）</span>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {row.enrolled} <span className="text-muted-foreground">（{pct(r.inquiryToEnrollment)}）</span>
                          </td>
                          <td className="py-2 pr-3 text-right">{row.closed_lost}</td>
                          <td className="py-2 pr-3 text-right">
                            {row.median_days_to_enroll === null ? <span className="text-muted-foreground">計算不能</span> : `${row.median_days_to_enroll}日`}
                          </td>
                          <td className="py-2 pr-3 text-right">{costCell(row, group, row.cost_jpy)}</td>
                          <td className="py-2 pr-3 text-right">{costCell(row, group, r.cpa)}</td>
                          <td className="py-2 text-right">{costCell(row, group, r.cac)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              入会までの日数は入会した人の中央値です。件数が少ない期間・グループの率は偶然の影響が大きいため、傾向の参考にとどめてください。チャネル間の差は、チャネルそのものの効果ではなく、問い合わせる人の違いによる可能性があります。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
