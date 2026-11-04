import { PlugZap } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/states/states'
import { Button } from '@/components/ui/button'
import { useOrgContext } from '@/features/organization/use-org-context'

/** Supabase に接続されていないときは、データを扱う画面の代わりに案内を出す */
export function DataGate({ children }: { children: ReactNode }) {
  const { ready } = useOrgContext()
  if (ready) return <>{children}</>
  return (
    <EmptyState
      icon={<PlugZap className="size-5" />}
      title="Supabase未接続のため、この機能はまだ使えません"
      description="画面の構成だけ確認できます。Supabaseに接続してログインすると、投稿や実績を記録できます。"
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/settings">接続方法を見る</Link>
        </Button>
      }
    />
  )
}
