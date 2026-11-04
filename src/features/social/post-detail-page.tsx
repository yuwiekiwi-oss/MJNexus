import { ArrowLeft, Copy, ExternalLink, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DomainBadge } from '@/components/analysis-badges'
import { DataGate } from '@/components/data-gate'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useOrgContext } from '@/features/organization/use-org-context'
import { FORMAT_LABEL, METRICS, PLATFORM_LABEL, POST_STATUS_LABEL, trackingUrl } from '@/lib/social'
import type { SnapshotKpiRow, SocialPostRow } from '@/types/database'
import { useAccounts, usePost, usePostSnapshots, useThemes } from './api'
import { dateTimeText, metricText, percentText } from './format'
import { MetricsForm } from './metrics-form'

function GrowthChart({ rows }: { rows: SnapshotKpiRow[] }) {
  const data = rows
    .filter((r) => r.hours_since_publish !== null)
    .map((r) => ({ hours: Number(r.hours_since_publish), views: r.views, reach: r.reach }))
  const hasValues = data.some((d) => d.views !== null || d.reach !== null)
  if (data.length < 2 || !hasValues) {
    return (
      <p className="text-sm text-muted-foreground">
        成長推移のグラフは、公開日時のある投稿で実績を2回以上記録すると表示されます。
      </p>
    )
  }
  return (
    <div className="h-64 w-full" role="img" aria-label="公開からの経過時間ごとの再生数とリーチ">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="hours"
            type="number"
            domain={[0, 'dataMax']}
            ticks={[0, ...data.map((d) => d.hours)]}
            tickFormatter={(h: number) => (h === 0 ? '公開' : h >= 48 && h % 24 === 0 ? `${h / 24}日後` : `${h}h後`)}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            stroke="var(--border)"
          />
          <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} stroke="var(--border)" width={56} />
          <Tooltip
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)' }}
            labelFormatter={(h) => `公開から ${h} 時間後`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
          <Line type="monotone" dataKey="views" name="再生数" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
          <Line type="monotone" dataKey="reach" name="リーチ" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function HistoryTable({ rows }: { rows: SnapshotKpiRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">記録日時</th>
            <th className="py-2 pr-3 font-medium">経過</th>
            {METRICS.map((m) => (
              <th key={m.id} className="py-2 pr-3 text-right font-medium">
                {m.label}
              </th>
            ))}
            <th className="py-2 text-right font-medium">ER（リーチ）</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.snapshot_id} className="border-b last:border-0">
              <td className="py-2 pr-3 whitespace-nowrap">{dateTimeText(r.recorded_at)}</td>
              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                {r.hours_since_publish === null ? '—' : `${r.hours_since_publish}h`}
              </td>
              {METRICS.map((m) => {
                const status = r[`${m.id}_status`]
                return (
                  <td key={m.id} className={`py-2 pr-3 text-right ${status === 'measured' ? '' : 'text-muted-foreground'}`}>
                    {metricText(r[m.id], status)}
                  </td>
                )
              })}
              <td className="py-2 text-right">{percentText(r.engagement_rate_reach)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrackingLink({ post, platform }: { post: SocialPostRow; platform: 'instagram' | 'tiktok' }) {
  const [base, setBase] = useState('https://')
  const [copied, setCopied] = useState(false)
  if (!post.tracking_code) {
    return <p className="text-sm text-muted-foreground">追跡コードが未設定です。投稿を編集して設定すると、問い合わせと投稿を確度高く紐づけられます。</p>
  }
  let url: string | null = null
  try {
    url = base.length > 8 ? trackingUrl(base, platform, post.tracking_code) : null
  } catch {
    url = null
  }
  return (
    <div className="space-y-2">
      <label htmlFor="tracking-base" className="text-sm font-medium">
        リンク先（体験授業の申込ページなど）
      </label>
      <Input id="tracking-base" value={base} onChange={(e) => setBase(e.target.value)} />
      {url && (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{url}</code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(url).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }}
          >
            <Copy /> {copied ? 'コピーしました' : 'コピー'}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        問い合わせフォームでこのパラメータを受け取る仕組みは Phase 3 で実装します。現時点では紐づけは未検証です。
      </p>
    </div>
  )
}

function PostDetail({ id }: { id: string }) {
  const { canEdit } = useOrgContext()
  const post = usePost(id)
  const snapshots = usePostSnapshots(id)
  const accounts = useAccounts()
  const themes = useThemes()
  const [showForm, setShowForm] = useState(false)

  if (post.isPending) return <LoadingState />
  if (post.isError) return <ErrorState description={post.error.message} onRetry={() => void post.refetch()} />
  if (!post.data) return <EmptyState title="投稿が見つかりません" />
  const p = post.data
  const account = accounts.data?.find((a) => a.id === p.account_id)
  const theme = themes.data?.find((t) => t.id === p.theme_id)

  return (
    <>
      <PageHeader
        title={p.title}
        description={`${account ? `${PLATFORM_LABEL[account.platform]} @${account.handle}` : ''} ・ ${FORMAT_LABEL[p.format]} ・ ${dateTimeText(p.published_at)}`}
        actions={
          canEdit && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/social/posts/${p.id}/edit`}>
                <Pencil /> 編集
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="outline">{POST_STATUS_LABEL[p.status]}</Badge>
        {theme && <Badge variant="secondary">{theme.name}</Badge>}
        {p.cta && <Badge variant="outline">CTA: {p.cta}</Badge>}
        {p.production_minutes !== null && <Badge variant="outline">制作 {p.production_minutes}分</Badge>}
        {p.post_url && (
          <a href={p.post_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            投稿を開く <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                実績の履歴 <DomainBadge domain="social" />
              </CardTitle>
              <CardDescription>同じ投稿の実績を時点ごとに記録し、伸び方を比べます。</CardDescription>
            </div>
            {canEdit && !showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                実績を記録
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {showForm && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <MetricsForm postId={p.id} publishedAt={p.published_at} onDone={() => setShowForm(false)} />
              </div>
            )}
            {snapshots.isPending ? (
              <LoadingState rows={2} />
            ) : snapshots.isError ? (
              <ErrorState description={snapshots.error.message} onRetry={() => void snapshots.refetch()} />
            ) : snapshots.data.length === 0 ? (
              <EmptyState title="まだ実績が記録されていません" description="公開24時間後・72時間後・7日後など、インサイトを見たタイミングで記録してください。" />
            ) : (
              <>
                <GrowthChart rows={snapshots.data} />
                <HistoryTable rows={snapshots.data} />
              </>
            )}
          </CardContent>
        </Card>

        {account && (
          <Card>
            <CardHeader>
              <CardTitle>追跡リンク</CardTitle>
              <CardDescription>投稿から問い合わせにつながったかを確かめるためのリンクです。</CardDescription>
            </CardHeader>
            <CardContent>
              <TrackingLink post={p} platform={account.platform} />
            </CardContent>
          </Card>
        )}

        {(p.hook || p.caption || p.target_audience) && (
          <Card>
            <CardHeader>
              <CardTitle>投稿内容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {p.hook && (
                <p>
                  <span className="text-muted-foreground">フック: </span>
                  {p.hook}
                </p>
              )}
              {p.target_audience && (
                <p>
                  <span className="text-muted-foreground">ターゲット: </span>
                  {p.target_audience}
                </p>
              )}
              {p.caption && <p className="whitespace-pre-wrap">{p.caption}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

export function PostDetailPage() {
  const { id } = useParams()
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/social">
          <ArrowLeft /> 投稿一覧
        </Link>
      </Button>
      <DataGate>{id && <PostDetail id={id} />}</DataGate>
    </>
  )
}
