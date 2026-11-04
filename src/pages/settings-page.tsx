import { type ThemePreference, useTheme } from '@/app/theme'
import { ConnectionBadge, getConnections } from '@/components/connection-status'
import { PageHeader } from '@/components/layout/page-header'
import { THEME_OPTIONS } from '@/components/layout/theme-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'
import { ROLE_LABEL, useCurrentOrganization } from '@/features/organization/use-organization'
import { cn } from '@/lib/utils'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-40 shrink-0 text-sm text-muted-foreground">{label}</div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { state } = useAuth()
  const { current } = useCurrentOrganization()
  const { preference, setPreference } = useTheme()

  return (
    <>
      <PageHeader title="Settings" description="アカウント・組織・表示・接続状況" />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>アカウント</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="メールアドレス">
              {state.status === 'signed_in' ? state.user.email : <span className="text-muted-foreground">未ログイン（Supabase未接続）</span>}
            </Row>
            <Row label="組織">{current ? current.organizationName : <span className="text-muted-foreground">—</span>}</Row>
            <Row label="権限">{current ? ROLE_LABEL[current.role] : <span className="text-muted-foreground">—</span>}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>表示</CardTitle>
            <CardDescription>テーマはこのブラウザに保存されます。</CardDescription>
          </CardHeader>
          <CardContent>
            <div role="radiogroup" aria-label="表示テーマ" className="inline-flex rounded-lg border p-1">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={preference === o.value}
                  onClick={() => setPreference(o.value as ThemePreference)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    preference === o.value ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>外部サービス接続</CardTitle>
            <CardDescription>シークレットキー（service_role など）はブラウザに置きません。</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {getConnections().map((c) => (
              <div key={c.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {c.name} <ConnectionBadge state={c.state} />
                </div>
                <p className="text-xs break-words text-muted-foreground">{c.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
