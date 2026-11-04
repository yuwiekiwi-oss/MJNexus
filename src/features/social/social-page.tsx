import { AtSign, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DataGate } from '@/components/data-gate'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOrgContext } from '@/features/organization/use-org-context'
import { FORMAT_LABEL, PLATFORM_LABEL, PLATFORMS, POST_STATUS_LABEL, type SocialPlatform } from '@/lib/social'
import { useAccounts, useCreateAccount, useCreateTheme, usePostKpis, useThemes } from './api'
import { CsvPanel } from './csv-panel'
import { DashboardPanel } from './dashboard-panel'
import { dateTimeText, metricText, percentText } from './format'

const TABS = ['posts', 'dashboard', 'accounts', 'csv'] as const
type Tab = (typeof TABS)[number]

function PostsPanel() {
  const posts = usePostKpis()
  const { canEdit } = useOrgContext()
  if (posts.isPending) return <LoadingState />
  if (posts.isError) return <ErrorState description={posts.error.message} onRetry={() => void posts.refetch()} />
  if (posts.data.length === 0) {
    return (
      <EmptyState
        icon={<AtSign className="size-5" />}
        title="まだ投稿が登録されていません"
        description="InstagramやTikTokに投稿したら、ここに登録して実績を記録します。"
        action={
          canEdit && (
            <Button asChild size="sm">
              <Link to="/social/posts/new">
                <Plus /> 投稿を登録
              </Link>
            </Button>
          )
        }
      />
    )
  }
  return (
    <Card className="gap-0 py-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm tabular-nums">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">投稿</th>
              <th className="px-3 py-2.5 font-medium">公開日時</th>
              <th className="px-3 py-2.5 text-right font-medium">再生数</th>
              <th className="px-3 py-2.5 text-right font-medium">リーチ</th>
              <th className="px-3 py-2.5 text-right font-medium">ER（リーチ）</th>
              <th className="px-3 py-2.5 text-right font-medium">保存率</th>
              <th className="px-4 py-2.5 text-right font-medium">最新の記録</th>
            </tr>
          </thead>
          <tbody>
            {posts.data.map((r) => (
              <tr key={r.post_id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                <td className="max-w-72 px-4 py-2.5">
                  <Link to={`/social/posts/${r.post_id}`} className="block truncate font-medium hover:underline">
                    {r.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted-foreground">
                    <span>{PLATFORM_LABEL[r.platform]}</span>·<span>{FORMAT_LABEL[r.format]}</span>
                    {r.theme_name && <>·<span className="truncate">{r.theme_name}</span></>}
                    {r.status !== 'published' && <Badge variant="outline">{POST_STATUS_LABEL[r.status]}</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{dateTimeText(r.published_at)}</td>
                <td className="px-3 py-2.5 text-right">{metricText(r.views, r.views_status)}</td>
                <td className="px-3 py-2.5 text-right">{metricText(r.reach, r.reach_status)}</td>
                <td className="px-3 py-2.5 text-right">{percentText(r.engagement_rate_reach)}</td>
                <td className="px-3 py-2.5 text-right">{percentText(r.save_rate)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap text-xs text-muted-foreground">
                  {r.snapshot_count === 0 ? '未記録' : `${r.hours_since_publish ?? '—'}h後 ・ ${r.snapshot_count}回`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function AccountsPanel() {
  const { canEdit } = useOrgContext()
  const accounts = useAccounts()
  const themes = useThemes()
  const createAccount = useCreateAccount()
  const createTheme = useCreateTheme()
  const [platform, setPlatform] = useState<SocialPlatform>('instagram')
  const [handle, setHandle] = useState('')
  const [handleError, setHandleError] = useState<string>()
  const [themeName, setThemeName] = useState('')

  async function addAccount(e: FormEvent) {
    e.preventDefault()
    const h = handle.trim().replace(/^@/, '')
    if (!/^[A-Za-z0-9._]{1,50}$/.test(h)) return setHandleError('英数字・ピリオド・アンダースコアで入力してください')
    setHandleError(undefined)
    await createAccount.mutateAsync({ platform, handle: h, display_name: null }).then(
      () => setHandle(''),
      () => undefined,
    )
  }
  async function addTheme(e: FormEvent) {
    e.preventDefault()
    const n = themeName.trim()
    if (!n || n.length > 50) return
    await createTheme.mutateAsync(n).then(
      () => setThemeName(''),
      () => undefined,
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>SNSアカウント</CardTitle>
          <CardDescription>投稿を記録するアカウントです。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.isPending ? (
            <LoadingState rows={2} />
          ) : accounts.isError ? (
            <ErrorState description={accounts.error.message} />
          ) : accounts.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ登録されていません。</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {accounts.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>@{a.handle}</span>
                  <Badge variant="outline">{PLATFORM_LABEL[a.platform]}</Badge>
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form onSubmit={addAccount} className="flex flex-wrap items-end gap-2" noValidate>
              <Field label="プラットフォーム" htmlFor="acc-platform" className="w-36">
                <NativeSelect id="acc-platform" value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)}>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {PLATFORM_LABEL[p]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="ユーザー名" htmlFor="acc-handle" error={handleError ?? createAccount.error?.message} className="min-w-40 flex-1">
                <Input id="acc-handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="mj_school" />
              </Field>
              <Button type="submit" disabled={createAccount.isPending}>
                追加
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>投稿テーマ</CardTitle>
          <CardDescription>テーマ別の比較に使います。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {themes.isPending ? (
            <LoadingState rows={2} />
          ) : themes.isError ? (
            <ErrorState description={themes.error.message} />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {themes.data.map((t) => (
                <Badge key={t.id} variant="secondary">
                  {t.name}
                </Badge>
              ))}
            </div>
          )}
          {canEdit && (
            <form onSubmit={addTheme} className="flex items-end gap-2">
              <Field label="テーマを追加" htmlFor="theme-name" error={createTheme.error?.message} className="flex-1">
                <Input id="theme-name" value={themeName} maxLength={50} onChange={(e) => setThemeName(e.target.value)} />
              </Field>
              <Button type="submit" disabled={createTheme.isPending || !themeName.trim()}>
                追加
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function SocialPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'posts'
  const { canEdit, ready } = useOrgContext()
  return (
    <>
      <PageHeader
        title="Social"
        description="Instagram・TikTokの投稿と実績を記録し、SNS上の反応を分析します。"
        actions={
          ready &&
          canEdit && (
            <Button asChild size="sm">
              <Link to="/social/posts/new">
                <Plus /> 投稿を登録
              </Link>
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'posts' ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="posts">投稿</TabsTrigger>
          <TabsTrigger value="dashboard">ダッシュボード</TabsTrigger>
          <TabsTrigger value="accounts">アカウント・テーマ</TabsTrigger>
          <TabsTrigger value="csv">CSV</TabsTrigger>
        </TabsList>
        <DataGate>
          <TabsContent value="posts">
            <PostsPanel />
          </TabsContent>
          <TabsContent value="dashboard">
            <DashboardPanel />
          </TabsContent>
          <TabsContent value="accounts">
            <AccountsPanel />
          </TabsContent>
          <TabsContent value="csv">
            <CsvPanel />
          </TabsContent>
        </DataGate>
      </Tabs>
    </>
  )
}
