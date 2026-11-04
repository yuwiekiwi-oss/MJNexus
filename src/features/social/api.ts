import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgContext } from '@/features/organization/use-org-context'
import type { MetricPayload, SocialPlatform } from '@/lib/social'
import type { Database, DataSource } from '@/types/database'

type PostInsert = Database['public']['Tables']['social_posts']['Insert']

/** DBエラーをユーザー向けの文言に変換（詳細はログに出さない） */
export function toDbErrorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback
  switch (error.code) {
    case 'DEMO':
      return 'デモ表示のため保存できません（サンプルデータは変更されません）。'
    case '23505':
      return '同じ内容がすでに登録されています（URL・追跡コード・記録日時の重複など）。'
    case '23514':
      return '入力内容がルールに合っていません。必須項目や値の範囲を確認してください。'
    case '42501':
      return 'この操作を行う権限がありません。'
    case '22023':
      return '入力内容が不正です（未来の日時、指標が空など）。'
    default:
      return fallback
  }
}

export const socialKeys = {
  accounts: (org: string | null) => ['social', org, 'accounts'] as const,
  themes: (org: string | null) => ['social', org, 'themes'] as const,
  postKpis: (org: string | null) => ['social', org, 'post-kpis'] as const,
  post: (id: string) => ['social', 'post', id] as const,
  snapshots: (id: string) => ['social', 'post', id, 'snapshots'] as const,
}

export function useAccounts() {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: socialKeys.accounts(orgId),
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await client!.from('social_accounts').select('*').eq('organization_id', orgId!).order('platform')
      if (error) throw new Error('アカウントを取得できませんでした。')
      return data
    },
  })
}

export function useCreateAccount() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { platform: SocialPlatform; handle: string; display_name: string | null }) => {
      const { error } = await client!.from('social_accounts').insert({ organization_id: orgId!, ...input })
      if (error) throw new Error(toDbErrorMessage(error, 'アカウントを登録できませんでした。'))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: socialKeys.accounts(orgId) }),
  })
}

export function useThemes() {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: socialKeys.themes(orgId),
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await client!
        .from('content_themes')
        .select('*')
        .eq('organization_id', orgId!)
        .order('sort_order')
      if (error) throw new Error('テーマを取得できませんでした。')
      return data
    },
  })
}

export function useCreateTheme() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await client!.from('content_themes').insert({ organization_id: orgId!, name, sort_order: 100 })
      if (error) throw new Error(toDbErrorMessage(error, 'テーマを追加できませんでした。'))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: socialKeys.themes(orgId) }),
  })
}

/** 投稿 × 最新記録時点のSNS指標（ビュー social_post_kpis） */
export function usePostKpis() {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: socialKeys.postKpis(orgId),
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await client!
        .from('social_post_kpis')
        .select('*')
        .eq('organization_id', orgId!)
        .order('published_at', { ascending: false, nullsFirst: true })
      if (error) throw new Error('投稿を取得できませんでした。')
      return data
    },
  })
}

export function usePost(id: string | undefined) {
  const { ready, client } = useOrgContext()
  return useQuery({
    queryKey: socialKeys.post(id ?? ''),
    enabled: ready && Boolean(id),
    queryFn: async () => {
      const { data, error } = await client!.from('social_posts').select('*').eq('id', id!).maybeSingle()
      if (error) throw new Error('投稿を取得できませんでした。')
      return data
    },
  })
}

export function usePostSnapshots(id: string | undefined) {
  const { ready, client } = useOrgContext()
  return useQuery({
    queryKey: socialKeys.snapshots(id ?? ''),
    enabled: ready && Boolean(id),
    queryFn: async () => {
      const { data, error } = await client!
        .from('social_post_snapshot_kpis')
        .select('*')
        .eq('post_id', id!)
        .order('recorded_at', { ascending: true })
      if (error) throw new Error('実績の履歴を取得できませんでした。')
      return data
    },
  })
}

export function useSavePost() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Omit<PostInsert, 'organization_id'> }) => {
      if (id) {
        const { error } = await client!.from('social_posts').update(values).eq('id', id)
        if (error) throw new Error(toDbErrorMessage(error, '投稿を保存できませんでした。'))
        return id
      }
      const { data, error } = await client!
        .from('social_posts')
        .insert({ organization_id: orgId!, ...values })
        .select('id')
        .single()
      if (error) throw new Error(toDbErrorMessage(error, '投稿を登録できませんでした。'))
      return data.id
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['social', orgId] })
      void qc.invalidateQueries({ queryKey: socialKeys.post(id) })
    },
  })
}

export function useRecordMetrics() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      postId: string
      recordedAt: string
      values: MetricPayload[]
      source?: DataSource
      note?: string | null
    }) => {
      const { error } = await client!.rpc('record_post_metrics', {
        p_post_id: input.postId,
        p_recorded_at: input.recordedAt,
        p_values: input.values,
        p_source: input.source ?? 'manual',
        p_note: input.note ?? null,
      })
      if (error) throw new Error(toDbErrorMessage(error, '実績を保存できませんでした。'))
    },
    onSuccess: (_d, input) => {
      void qc.invalidateQueries({ queryKey: socialKeys.snapshots(input.postId) })
      void qc.invalidateQueries({ queryKey: socialKeys.postKpis(orgId) })
    },
  })
}
