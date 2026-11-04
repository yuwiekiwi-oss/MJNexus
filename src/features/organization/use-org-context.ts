import { useAuth } from '@/features/auth/auth-context'
import type { MemberRole } from '@/types/database'
import { useCurrentOrganization } from './use-organization'

const RANK: Record<MemberRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 }

export function hasRole(role: MemberRole | null | undefined, min: MemberRole): boolean {
  return role ? RANK[role] >= RANK[min] : false
}

/**
 * データ操作に必要な文脈（クライアント・組織・権限）。
 * ready=false のとき（未接続・未ログイン・組織なし）はデータを扱わない。
 * 画面の権限表示はUXのためで、実際の制御はRLS。
 */
export function useOrgContext() {
  const { client, state } = useAuth()
  const { current } = useCurrentOrganization()
  const ready = Boolean(client && state.status === 'signed_in' && current)
  return {
    ready,
    connected: state.status !== 'unconfigured',
    client,
    orgId: current?.organizationId ?? null,
    role: current?.role ?? null,
    canEdit: hasRole(current?.role, 'editor'),
    userId: state.status === 'signed_in' ? state.user.id : null,
  }
}
