import { ChartLine, Info } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DomainBadge, SampleLevelBadge } from '@/components/analysis-badges'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { formatKpiValue, getKpi } from '@/lib/kpi-catalog'
import { METRIC_LABEL, type SocialMetric } from '@/lib/social'
import { usePostKpis } from './api'
import {
  compareGroups,
  comparisonLevel,
  coverage,
  DASHBOARD_KPIS,
  type DashboardKpiId,
  type Dimension,
  DIMENSIONS,
} from './dashboard-model'
import { dateTimeText } from './format'

/** 長いラベルは省略して1行に収める（全文は表とツールチップで確認できる） */
function CategoryTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const label = props.payload?.value ?? ''
  const short = label.length > 11 ? `${label.slice(0, 10)}…` : label
  return (
    <text x={props.x} y={props.y} dy={4} textAnchor="end" fill="var(--foreground)" fontSize={12}>
      <title>{label}</title>
      {short}
    </text>
  )
}

function kpiMeta(id: DashboardKpiId) {
  if (id === 'follows_gained') {
    return { name: 'フォロワー増加数', formula: '最新記録時点のフォロワー増加数', denominator: '', unit: 'count' as const }
  }
  return getKpi(id)
}

export function DashboardPanel() {
  const posts = usePostKpis()
  const [kpi, setKpi] = useState<DashboardKpiId>('engagement_rate_reach')
  const [dim, setDim] = useState<Dimension>('platform')

  if (posts.isPending) return <LoadingState />
  if (posts.isError) return <ErrorState description={posts.error.message} onRetry={() => void posts.refetch()} />

  const cov = coverage(posts.data)
  const meta = kpiMeta(kpi)
  const groups = compareGroups(posts.data, dim, kpi)
  const level = comparisonLevel(groups)
  const chartData = groups.filter((g) => g.median !== null).map((g) => ({ label: g.label, median: g.median, n: g.n }))

  return (
    <div className="space-y-6">
      <Alert role="note">
        <Info />
        <AlertTitle className="flex flex-wrap items-center gap-2">
          ここはSNS分析です <DomainBadge domain="social" />
        </AlertTitle>
        <AlertDescription>
          プラットフォームの集計値に基づく「どの投稿が見られ、反応されたか」の分析です。問い合わせ・入会・売上へのつながり（経営分析）は Phase 3 以降で、記録した問い合わせをもとに別に集計します。SNSの数字から入会数を推定することはしません。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            データの状況 <SampleLevelBadge level={cov.level} />
          </CardTitle>
          <CardDescription>
            {cov.recordedPosts === 0
              ? '実績が記録された公開済み投稿がまだありません。以下の分析はすべて未検証です。'
              : `${dateTimeText(cov.periodStart)} 〜 ${dateTimeText(cov.periodEnd)} に公開された ${cov.recordedPosts} 件（登録 ${cov.totalPosts} 件中）`}
          </CardDescription>
        </CardHeader>
        {cov.recordedPosts > 0 && (
          <CardContent>
            <div className="text-xs text-muted-foreground">最新の記録で実測でない割合（未記録・未取得・非対応）</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(cov.notMeasuredRate).map(([m, rate]) => (
                <div key={m} className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-xs tabular-nums">
                  <span>{METRIC_LABEL[m as SocialMetric]}</span>
                  <span className={rate > 0.5 ? 'font-medium text-warning' : ''}>{Math.round(rate * 100)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="指標" htmlFor="dash-kpi" className="w-60">
              <NativeSelect id="dash-kpi" value={kpi} onChange={(e) => setKpi(e.target.value as DashboardKpiId)}>
                {DASHBOARD_KPIS.map((k) => (
                  <option key={k} value={k}>
                    {kpiMeta(k).name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="比較の切り口" htmlFor="dash-dim" className="w-52">
              <NativeSelect id="dash-dim" value={dim} onChange={(e) => setDim(e.target.value as Dimension)}>
                {DIMENSIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">計算式</span>: {meta.formula}
            {meta.denominator && <> ・ 分母: {meta.denominator}</>} ・ 各グループの<strong>中央値</strong>を表示（外れ値の影響を受けにくいため）
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {chartData.length === 0 ? (
            <EmptyState
              icon={<ChartLine className="size-5" />}
              title="未検証：比較できるデータがありません"
              description="この指標を計算できる投稿がまだありません。実績を記録すると表示されます。計算に必要な指標が未取得・非対応の投稿は含めません。"
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                比較の信頼度 <SampleLevelBadge level={level} />
                {level !== 'inferential' && <span>件数が少ないため、差があっても偶然の可能性があります。傾向の参考にとどめてください。</span>}
              </div>
              <div className="w-full" style={{ height: Math.max(160, chartData.length * 44 + 40) }} role="img" aria-label={`${meta.name}の${DIMENSIONS.find((d) => d.id === dim)?.label}別の中央値`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap={10}>
                    <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      stroke="var(--border)"
                      tickFormatter={(v: number) => formatKpiValue(meta.unit, v)}
                    />
                    <YAxis type="category" dataKey="label" width={150} tick={<CategoryTick />} stroke="var(--border)" interval={0} />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)' }}
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)' }}
                      formatter={(v, _n, item) => [`${formatKpiValue(meta.unit, Number(v))}（n=${(item.payload as { n: number }).n}）`, '中央値']}
                    />
                    <Bar dataKey="median" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList
                        dataKey="median"
                        position="right"
                        formatter={(v: unknown) => formatKpiValue(meta.unit, Number(v))}
                        style={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {groups.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">グループ</th>
                    <th className="py-2 pr-3 text-right font-medium">n（計算できた投稿 / 全投稿）</th>
                    <th className="py-2 pr-3 text-right font-medium">中央値</th>
                    <th className="py-2 pr-3 text-right font-medium">最小〜最大</th>
                    <th className="py-2 font-medium">信頼度</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.key} className="border-b last:border-0">
                      <td className="py-2 pr-3">{g.label}</td>
                      <td className="py-2 pr-3 text-right">
                        {g.n} / {g.total}
                      </td>
                      <td className="py-2 pr-3 text-right">{formatKpiValue(meta.unit, g.median)}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">
                        {g.n === 0 ? '—' : `${formatKpiValue(meta.unit, g.min)} 〜 ${formatKpiValue(meta.unit, g.max)}`}
                      </td>
                      <td className="py-2">
                        <SampleLevelBadge level={g.level} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            これは記述統計（相関）です。あるテーマの数値が高くても、それが原因とは限りません（投稿時期・内容の質など他の要因の影響があります）。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
