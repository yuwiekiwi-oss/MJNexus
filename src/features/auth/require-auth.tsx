import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '@/components/states/states'
import { CreateOrganizationPage } from '@/features/organization/create-organization-page'
import { useCurrentOrganization } from '@/features/organization/use-organization'
import { useAuth } from './auth-context'

function FullPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">{children}</div>
}

function RequireOrganization({ children }: { children: ReactNode }) {
  const org = useCurrentOrganization()
  if (org.isPending) {
    return (
      <FullPage>
        <LoadingState label="組織情報を読み込み中…" />
      </FullPage>
    )
  }
  if (org.isError) {
    return (
      <FullPage>
        <ErrorState description={org.error.message} onRetry={() => void org.refetch()} />
      </FullPage>
    )
  }
  if (!org.current) return <CreateOrganizationPage />
  return <>{children}</>
}

/**
 * 認証ガード
 * - Supabase未接続: 画面確認用に表示のみ許可（データは扱わない）
 * - 未ログイン: /login へ
 * - ログイン済みで組織なし: 組織作成画面
 * 注意: これはUX上のガード。実際のデータ保護はDBのRLSが担う。
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'unconfigured') return <>{children}</>
  if (state.status === 'loading') {
    return (
      <FullPage>
        <LoadingState label="認証状態を確認中…" />
      </FullPage>
    )
  }
  if (state.status === 'signed_out') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <RequireOrganization>{children}</RequireOrganization>
}
