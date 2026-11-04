import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgContext } from '@/features/organization/use-org-context'
import { toDbErrorMessage } from '@/features/social/api'
import type { IdeaStatus } from '@/lib/social'
import type { Database } from '@/types/database'

type IdeaInsert = Database['public']['Tables']['content_ideas']['Insert']

export const ideaKeys = { all: (org: string | null) => ['ideas', org] as const }

export function useIdeas() {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: ideaKeys.all(orgId),
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await client!
        .from('content_ideas')
        .select('*')
        .eq('organization_id', orgId!)
        .order('planned_publish_date', { ascending: true, nullsFirst: false })
      if (error) throw new Error('企画を取得できませんでした。')
      return data
    },
  })
}

export function useSaveIdea() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Omit<IdeaInsert, 'organization_id'> }) => {
      const { error } = id
        ? await client!.from('content_ideas').update(values).eq('id', id)
        : await client!.from('content_ideas').insert({ organization_id: orgId!, ...values })
      if (error) throw new Error(toDbErrorMessage(error, '企画を保存できませんでした。'))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ideaKeys.all(orgId) }),
  })
}

export function useMoveIdea() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IdeaStatus }) => {
      const { error } = await client!.from('content_ideas').update({ status }).eq('id', id)
      if (error) throw new Error(toDbErrorMessage(error, 'ステータスを変更できませんでした。'))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ideaKeys.all(orgId) }),
  })
}
