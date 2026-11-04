import { Inbox, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { DomainBadge } from '@/components/analysis-badges'
import { DataGate } from '@/components/data-gate'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOrgContext } from '@/features/organization/use-org-context'
import { dateTimeText } from '@/features/social/format'
import { gradeLabel } from '@/lib/marketing'
import { usePipeline } from './api'
import { CostsPanel } from './costs-panel'
import { FunnelPanel } from './funnel-panel'
import { AttributionBadge, StageBadge } from './marketing-badges'
import { SettingsPanel } from './settings-panel'

const TABS = ['inquiries', 'funnel', 'costs', 'settings'] as const
type Tab = (typeof TABS)[number]

function InquiriesPanel() {
  const list = usePipeline()
  const { canEdit } = useOrgContext()
  if (list.isPending) return <LoadingState />
  if (list.isError) return <ErrorState description={list.error.message} onRetry={() => void list.refetch()} />
  if (list.data.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-5" />}
        title="まだ問い合わせが登録されていません"
        description="問い合わせが来たら登録し、体験・入会まで記録します。記録がそのまま集客ファネルになります。"
        action={
          canEdit && (
            <Button asChild size="sm">
              <Link to="/marketing/inquiries/new">
                <Plus /> 問い合わせを登録
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
              <th className="px-4 py-2.5 font-medium">問い合わせ日時</th>
              <th className="px-3 py-2.5 font-medium">進捗</th>
              <th className="px-3 py-2.5 font-medium">チャネル</th>
              <th className="px-3 py-2.5 font-medium">紐づけ</th>
              <th className="px-3 py-2.5 font-medium">関連投稿</th>
              <th className="px-3 py-2.5 font-medium">学年</th>
              <th className="px-4 py-2.5 font-medium">次の体験</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((r) => (
              <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link to={`/marketing/inquiries/${r.id}`} className="font-medium hover:underline">
                    {dateTimeText(r.inquired_at)}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <StageBadge stage={r.stage} />
                </td>
                <td className="px-3 py-2.5">{r.channel_name ?? <span className="text-muted-foreground">未設定</span>}</td>
                <td className="px-3 py-2.5">
                  <AttributionBadge value={r.attribution} />
                </td>
                <td className="max-w-56 truncate px-3 py-2.5">{r.post_title ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5">{gradeLabel(r.child_grade)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{r.next_trial_at ? dateTimeText(r.next_trial_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function MarketingPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'inquiries'
  const { canEdit, ready } = useOrgContext()
  return (
    <>
      <PageHeader
        title="Marketing"
        description="問い合わせ・体験・入会を記録し、集客の成果と費用対効果を見ます。"
        actions={
          <>
            <DomainBadge domain="business" />
            {ready && canEdit && (
              <Button asChild size="sm">
                <Link to="/marketing/inquiries/new">
                  <Plus /> 問い合わせを登録
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'inquiries' ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="inquiries">問い合わせ</TabsTrigger>
          <TabsTrigger value="funnel">ファネル</TabsTrigger>
          <TabsTrigger value="costs">集客費用</TabsTrigger>
          <TabsTrigger value="settings">チャネル・コース</TabsTrigger>
        </TabsList>
        <DataGate>
          <TabsContent value="inquiries">
            <InquiriesPanel />
          </TabsContent>
          <TabsContent value="funnel">
            <FunnelPanel />
          </TabsContent>
          <TabsContent value="costs">
            <CostsPanel />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>
        </DataGate>
      </Tabs>
    </>
  )
}
