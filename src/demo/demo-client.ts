/**
 * デモ表示用の読み取り専用クライアント（Supabase互換の最小実装）。
 * 書き込みはすべて「デモのため保存できません」エラーを返す。
 */
import type { Session } from '@supabase/supabase-js'
import type { MjSupabaseClient } from '@/lib/supabase'
import { todayJst } from '@/lib/marketing'
import { DEMO_ORG_ID, demoAccounts, demoIdeas, demoPostKpis, demoPosts, demoSnapshots, demoThemes } from './demo-data'
import {
  demoCampaigns,
  demoChannels,
  demoCosts,
  demoCourses,
  demoEnrollments,
  demoFunnel,
  demoPipeline,
  demoTrials,
} from './demo-marketing'

type Row = Record<string, unknown>
const DEMO_ERROR = { code: 'DEMO', message: 'demo mode' }

const tables: Record<string, Row[]> = {
  // 集客費用・CPA/CAC も確認できるよう、デモは管理者として表示する（書き込みはすべて拒否）
  organization_members: [{ role: 'admin', organization_id: DEMO_ORG_ID, organizations: { name: 'MJ（デモ）' } }],
  social_accounts: demoAccounts,
  content_themes: demoThemes,
  content_ideas: demoIdeas,
  social_posts: demoPosts,
  social_post_kpis: demoPostKpis,
  social_post_snapshot_kpis: demoSnapshots,
  marketing_channels: demoChannels,
  campaigns: demoCampaigns,
  courses: demoCourses,
  inquiry_pipeline: demoPipeline,
  trial_lessons: demoTrials,
  enrollments: demoEnrollments,
  inquiry_contacts: [], // 個人情報はサンプルでも作らない
  marketing_costs: demoCosts,
}

function builder(table: string) {
  const filters: [string, unknown][] = []
  let mode: 'many' | 'one' = 'many'
  let write = false
  const b = {
    select: () => b,
    eq: (c: string, v: unknown) => (filters.push([c, v]), b),
    order: () => b,
    single: () => ((mode = 'one'), b),
    maybeSingle: () => ((mode = 'one'), b),
    insert: () => ((write = true), b),
    update: () => ((write = true), b),
    delete: () => ((write = true), b),
    then: (resolve: (v: unknown) => unknown) => {
      if (write) return Promise.resolve({ data: null, error: DEMO_ERROR }).then(resolve)
      const rows = (tables[table] ?? []).filter((r) =>
        filters.every(([c, v]) => table === 'organization_members' || !(c in r) || r[c] === v),
      )
      return Promise.resolve({ data: mode === 'one' ? (rows[0] ?? null) : rows, error: null }).then(resolve)
    },
  }
  return b
}

const session = {
  access_token: 'demo',
  refresh_token: 'demo',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'demo-user', email: 'demo@example.invalid', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-11-01T00:00:00Z' },
} as Session

export const demoClient = {
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ error: DEMO_ERROR }),
    signInWithOtp: async () => ({ error: DEMO_ERROR }),
    signOut: async () => ({ error: null }),
  },
  from: builder,
  rpc: async (fn: string, args: Parameters<typeof demoFunnel>[0]) =>
    fn === 'marketing_funnel' ? { data: demoFunnel(args, todayJst()), error: null } : { data: null, error: DEMO_ERROR },
} as unknown as MjSupabaseClient
