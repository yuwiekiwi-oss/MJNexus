import { ChartLine, CircleCheck } from 'lucide-react'
import { Link } from 'react-router'
import { ConnectionBadge, getConnections } from '@/components/connection-status'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/states/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'
import { ROLE_LABEL, useCurrentOrganization } from '@/features/organization/use-organization'
import { NAV_GROUPS } from '@/lib/nav'

function OrganizationSummary() {
  const { current } = useCurrentOrganization()
  if (!current) return null
  return (
    <p className="text-sm text-muted-foreground">
      {current.organizationName} ・ {ROLE_LABEL[current.role]}
    </p>
  )
}

export function OverviewPage() {
  const { state } = useAuth()
  const connections = getConnections()
  const modules = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.id !== 'overview')

  return (
    <>
      <PageHeader title="Overview" description="MJ Nexus のセットアップ状況と開発ロードマップ" />
      {state.status === 'signed_in' && (
        <div className="-mt-4 mb-6">
          <OrganizationSummary />
        </div>
      )}

      <section aria-labelledby="kpi-heading" className="mb-8">
        <h2 id="kpi-heading" className="mb-3 text-sm font-medium">
          主要指標
        </h2>
        <EmptyState
          icon={<ChartLine className="size-5" />}
          title="まだ実績データがありません"
          description="開業準備段階のため、経営指標（問い合わせ・入会・売上）はまだ未検証です。SNS投稿と実績は Social で記録でき、SNS指標はそちらのダッシュボードで確認できます。架空の数値は表示しません。"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/social">Social を開く</Link>
            </Button>
          }
        />
      </section>

      <section aria-labelledby="connections-heading" className="mb-8">
        <h2 id="connections-heading" className="mb-3 text-sm font-medium">
          接続状況
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {connections.map((c) => (
            <Card key={c.id} className="gap-2 py-4">
              <CardHeader className="flex-row items-center justify-between gap-2 px-4">
                <CardTitle>{c.name}</CardTitle>
                <ConnectionBadge state={c.state} />
              </CardHeader>
              <CardContent className="px-4">
                <CardDescription className="text-xs break-words">{c.detail}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading" className="mb-3 text-sm font-medium">
          モジュール開発状況
        </h2>
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            <li className="flex items-center gap-3 px-4 py-3">
              <CircleCheck className="size-4 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">共通基盤</div>
                <div className="text-xs text-muted-foreground">レイアウト・認証・DBスキーマ・RLS・テスト環境</div>
              </div>
              <Badge variant="success">Phase 1 ・ 実装済み</Badge>
            </li>
            {modules.map((m) => {
              const Icon = m.icon
              return (
                <li key={m.id}>
                  <Link to={m.path} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.description}</div>
                    </div>
                    {m.status === 'available' ? (
                      <Badge variant="success">Phase {m.phase} ・ 実装済み</Badge>
                    ) : (
                      <Badge variant="soon">Phase {m.phase} ・ Coming Soon</Badge>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      </section>
    </>
  )
}
