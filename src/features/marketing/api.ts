import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgContext } from '@/features/organization/use-org-context'
import { toDbErrorMessage } from '@/lib/db-errors'
import type { FunnelGroup, FunnelRow, TrialStatus } from '@/lib/marketing'
import type { Database } from '@/types/database'

type T = Database['public']['Tables']
type InquiryInsert = Omit<T['inquiries']['Insert'], 'organization_id'>

/** 入会RPCなど、集客機能に固有のエラー */
function marketingError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (error?.code === 'P0002') return '対象のデータが見つかりません（削除済み、または権限がありません）。'
  if (error?.code === '22023' && error.message?.includes('enrolled_on')) return '入会日が問い合わせ日より前になっています。'
  if (error?.code === '23505') return 'すでに登録されています（1つの問い合わせから入会は1件まで、コード・名前の重複など）。'
  return toDbErrorMessage(error, fallback)
}

export const marketingKeys = {
  all: (org: string | null) => ['marketing', org] as const,
  channels: (org: string | null) => ['marketing', org, 'channels'] as const,
  campaigns: (org: string | null) => ['marketing', org, 'campaigns'] as const,
  courses: (org: string | null) => ['marketing', org, 'courses'] as const,
  costs: (org: string | null) => ['marketing', org, 'costs'] as const,
  pipeline: (org: string | null) => ['marketing', org, 'pipeline'] as const,
  inquiry: (org: string | null, id: string) => ['marketing', org, 'inquiry', id] as const,
  funnel: (org: string | null, from: string, to: string, group: FunnelGroup) =>
    ['marketing', org, 'funnel', from, to, group] as const,
}

export function useChannels() {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: marketingKeys.channels(orgId),
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await client!.from('marketing_channels').select('*').eq('organization_id', orgId!).order('created_at')
      if (error) throw new Error('チャネルを取得できませんでした。')
      return data
    },
  })
}
export function useCampaigns() {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: marketingKeys.campaigns(orgId),
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await client!.from('campaigns').select('*').eq('organization_id', orgId!).order('created_at')
      if (error) throw new Error('キャンペーンを取得できませんでした。')
      return data
    },
  })
}
export function useCourses() {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: marketingKeys.courses(orgId),
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await client!.from('courses').select('*').eq('organization_id', orgId!).order('created_at')
      if (error) throw new Error('コースを取得できませんでした。')
      return data
    },
  })
}

export function usePipeline() {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: marketingKeys.pipeline(orgId),
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await client!
        .from('inquiry_pipeline')
        .select('*')
        .eq('organization_id', orgId!)
        .order('inquired_at', { ascending: false })
      if (error) throw new Error('問い合わせを取得できませんでした。')
      return data
    },
  })
}

/** 問い合わせ1件の詳細（進捗・体験・入会・連絡先）。連絡先は admin 以上のみ（RLS） */
export function useInquiry(id: string | undefined) {
  const { ready, client, orgId } = useOrgContext()
  return useQuery({
    queryKey: marketingKeys.inquiry(orgId, id ?? ''),
    enabled: ready && Boolean(id),
    queryFn: async () => {
      const [inq, trials, contact, enrollment] = await Promise.all([
        client!.from('inquiry_pipeline').select('*').eq('id', id!).maybeSingle(),
        client!.from('trial_lessons').select('*').eq('inquiry_id', id!).order('scheduled_at'),
        client!.from('inquiry_contacts').select('*').eq('inquiry_id', id!).maybeSingle(),
        client!.from('enrollments').select('*').eq('inquiry_id', id!).maybeSingle(),
      ])
      if (inq.error || trials.error) throw new Error('問い合わせを取得できませんでした。')
      return {
        inquiry: inq.data,
        trials: trials.data,
        // 権限がない場合はRLSで0件になる（エラーではない）
        contact: contact.error ? null : contact.data,
        enrollment: enrollment.error ? null : enrollment.data,
      }
    },
  })
}

export function useCreateInquiry() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      values,
      contact,
    }: {
      values: InquiryInsert
      contact: { guardian_name: string; email: string | null; phone: string | null } | null
    }) => {
      const { data, error } = await client!
        .from('inquiries')
        .insert({ organization_id: orgId!, ...values })
        .select('id')
        .single()
      if (error) throw new Error(marketingError(error, '問い合わせを登録できませんでした。'))
      if (contact) {
        const c = await client!.from('inquiry_contacts').insert({ organization_id: orgId!, inquiry_id: data.id, ...contact })
        if (c.error) {
          // 問い合わせ自体は保存済み。連絡先だけ失敗したことを伝える
          return { id: data.id, contactError: marketingError(c.error, '連絡先を保存できませんでした。') }
        }
      }
      return { id: data.id, contactError: null }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.all(orgId) }),
  })
}

export function useAddTrial(inquiryId: string) {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { booked_at: string; scheduled_at: string; notes: string | null }) => {
      const { error } = await client!.from('trial_lessons').insert({ organization_id: orgId!, inquiry_id: inquiryId, ...input })
      if (error) throw new Error(marketingError(error, '体験を登録できませんでした。'))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.all(orgId) }),
  })
}

/** 体験の状態変更。DBの制約（参加なら参加日時、キャンセルならキャンセル日時が必須）に合わせて日時を入れる */
export function trialStatusUpdate(status: TrialStatus, scheduledAt: string, now: Date = new Date()) {
  return {
    status,
    attended_at: status === 'attended' ? scheduledAt : null,
    cancelled_at: status === 'cancelled' ? now.toISOString() : null,
  }
}

export function useUpdateTrialStatus() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: TrialStatus; scheduledAt: string }) => {
      const { error } = await client!
        .from('trial_lessons')
        .update(trialStatusUpdate(input.status, input.scheduledAt))
        .eq('id', input.id)
      if (error) throw new Error(marketingError(error, '体験の状態を更新できませんでした。'))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.all(orgId) }),
  })
}

export function useSetLost(inquiryId: string) {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { lost: boolean; reason: string | null }) => {
      const { error } = await client!
        .from('inquiries')
        .update(
          input.lost
            ? { closed_lost_at: new Date().toISOString(), closed_lost_reason: input.reason }
            : { closed_lost_at: null, closed_lost_reason: null },
        )
        .eq('id', inquiryId)
      if (error) throw new Error(marketingError(error, '更新できませんでした。'))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.all(orgId) }),
  })
}

export function useRecordEnrollment(inquiryId: string) {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      displayName: string
      grade: number | null
      courseId: string
      enrolledOn: string
      monthlyFee: number | null
    }) => {
      const { error } = await client!.rpc('record_enrollment', {
        p_inquiry_id: inquiryId,
        p_display_name: input.displayName,
        p_grade: input.grade,
        p_course_id: input.courseId,
        p_enrolled_on: input.enrolledOn,
        p_monthly_fee_jpy: input.monthlyFee,
      })
      if (error) throw new Error(marketingError(error, '入会を記録できませんでした。'))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.all(orgId) }),
  })
}

export function useFunnel(from: string, to: string, group: FunnelGroup) {
  const { ready, client, orgId, role } = useOrgContext()
  const allowed = role !== 'viewer'
  return useQuery({
    queryKey: marketingKeys.funnel(orgId, from, to, group),
    enabled: ready && allowed && Boolean(from && to) && from <= to,
    queryFn: async () => {
      const { data, error } = await client!.rpc('marketing_funnel', { p_org: orgId!, p_from: from, p_to: to, p_group: group })
      if (error) throw new Error(marketingError(error, 'ファネルを集計できませんでした。'))
      // PostgREST は bigint / numeric を数値で返すが、念のため数値に揃える
      return (data ?? []).map(
        (r): FunnelRow => ({
          ...r,
          inquiries: Number(r.inquiries),
          tracked_inquiries: Number(r.tracked_inquiries),
          trial_booked: Number(r.trial_booked),
          trial_attended: Number(r.trial_attended),
          enrolled: Number(r.enrolled),
          closed_lost: Number(r.closed_lost),
          open_recent: Number(r.open_recent),
          median_days_to_enroll: r.median_days_to_enroll === null ? null : Number(r.median_days_to_enroll),
          cost_jpy: r.cost_jpy === null ? null : Number(r.cost_jpy),
        }),
      )
    },
  })
}

export function useCosts() {
  const { ready, client, orgId, role } = useOrgContext()
  return useQuery({
    queryKey: marketingKeys.costs(orgId),
    enabled: ready && (role === 'admin' || role === 'owner'),
    queryFn: async () => {
      const { data, error } = await client!
        .from('marketing_costs')
        .select('*')
        .eq('organization_id', orgId!)
        .order('occurred_on', { ascending: false })
      if (error) throw new Error('集客費用を取得できませんでした。')
      return data
    },
  })
}

export function useCreateCost() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<T['expense_transactions']['Insert'], 'organization_id'>) => {
      const { error } = await client!.from('expense_transactions').insert({ organization_id: orgId!, ...values })
      if (error) throw new Error(marketingError(error, '費用を登録できませんでした。'))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.all(orgId) }),
  })
}

export function useCreateChannel() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<T['marketing_channels']['Insert'], 'organization_id'>) => {
      const { error } = await client!.from('marketing_channels').insert({ organization_id: orgId!, ...values })
      if (error) throw new Error(marketingError(error, 'チャネルを追加できませんでした。'))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.channels(orgId) }),
  })
}

export function useCreateCampaign() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<T['campaigns']['Insert'], 'organization_id'>) => {
      const { error } = await client!.from('campaigns').insert({ organization_id: orgId!, ...values })
      if (error) throw new Error(marketingError(error, 'キャンペーンを追加できませんでした。'))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.campaigns(orgId) }),
  })
}

export function useCreateCourse() {
  const { client, orgId } = useOrgContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: { name: string; monthly_fee_jpy: number }) => {
      const { error } = await client!.from('courses').insert({ organization_id: orgId!, ...values })
      if (error) throw new Error(marketingError(error, 'コースを追加できませんでした。'))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketingKeys.courses(orgId) }),
  })
}
