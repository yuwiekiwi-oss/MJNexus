import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import type { MemberRole } from '@/types/database'

export interface Membership {
  organizationId: string
  organizationName: string
  role: MemberRole
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'オーナー',
  admin: '管理者',
  editor: '編集者',
  viewer: '閲覧者',
}

/** ログインユーザーの所属組織（RLSにより自分の所属分だけが返る） */
export function useMemberships() {
  const { state, client } = useAuth()
  const userId = state.status === 'signed_in' ? state.user.id : null
  return useQuery({
    queryKey: ['memberships', userId],
    enabled: Boolean(client && userId),
    queryFn: async (): Promise<Membership[]> => {
      if (!client || !userId) return []
      const { data, error } = await client
        .from('organization_members')
        .select('role, organization_id, organizations(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (error) throw new Error('組織情報を取得できませんでした。')
      return data.map((m) => ({
        organizationId: m.organization_id,
        organizationName: m.organizations?.name ?? '(名称未設定)',
        role: m.role,
      }))
    },
  })
}

/** 現在の組織（最初の所属組織。複数組織の切り替えは将来対応） */
export function useCurrentOrganization() {
  const q = useMemberships()
  return { ...q, current: q.data?.[0] ?? null }
}

export function useCreateOrganization() {
  const { client } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      if (!client) throw new Error('Supabaseが未接続です。')
      const { data, error } = await client.rpc('create_organization', { org_name: name })
      if (error) throw new Error('組織を作成できませんでした。')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memberships'] }),
  })
}
