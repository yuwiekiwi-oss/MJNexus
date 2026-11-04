import type { Session } from '@supabase/supabase-js'
import type { MjSupabaseClient } from '@/lib/supabase'

type Row = Record<string, unknown>

/**
 * テスト用の最小限の Supabase クライアント。
 * 実ネットワークに接続せず、テーブルごとの返却データを差し替えられる。
 * eq() の条件で行を絞り込み、insert/update/rpc の呼び出しを記録する。
 */
export function createFakeSupabase(opts: {
  session?: Session | null
  memberships?: { role: string; organization_id: string; organizations: { name: string } | null }[]
  tables?: Record<string, Row[]>
  signInError?: string | null
  rpcError?: { code: string; message: string } | null
}) {
  const calls = {
    signInWithPassword: 0,
    rpc: [] as { fn: string; args: unknown }[],
    insert: [] as { table: string; values: unknown }[],
    update: [] as { table: string; values: unknown }[],
  }
  const tables: Record<string, Row[]> = { organization_members: opts.memberships ?? [], ...opts.tables }

  function builder(table: string) {
    const filters: [string, unknown][] = []
    let mode: 'select' | 'single' | 'maybeSingle' = 'select'
    let mutation: 'insert' | 'update' | null = null
    const b = {
      select: () => b,
      eq: (col: string, val: unknown) => {
        filters.push([col, val])
        return b
      },
      order: () => b,
      single: () => {
        mode = 'single'
        return b
      },
      maybeSingle: () => {
        mode = 'maybeSingle'
        return b
      },
      insert: (values: unknown) => {
        mutation = 'insert'
        calls.insert.push({ table, values })
        return b
      },
      update: (values: unknown) => {
        mutation = 'update'
        calls.update.push({ table, values })
        return b
      },
      then: (resolve: (v: { data: unknown; error: null }) => unknown) => {
        if (mutation === 'insert') return Promise.resolve({ data: { id: 'new-id' }, error: null }).then(resolve)
        if (mutation === 'update') return Promise.resolve({ data: null, error: null }).then(resolve)
        // organization_members は user_id で絞り込まない（テストでは常に所属あり）
        const rows = (tables[table] ?? []).filter((r) =>
          filters.every(([c, v]) => table === 'organization_members' || !(c in r) || r[c] === v),
        )
        const data = mode === 'select' ? rows : (rows[0] ?? null)
        return Promise.resolve({ data, error: null }).then(resolve)
      },
    }
    return b
  }

  const client = {
    auth: {
      getSession: async () => ({ data: { session: opts.session ?? null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => {
        calls.signInWithPassword++
        return { error: opts.signInError ? { message: opts.signInError } : null }
      },
      signInWithOtp: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => builder(table),
    rpc: async (fn: string, args: unknown) => {
      calls.rpc.push({ fn, args })
      if (opts.rpcError) return { data: null, error: opts.rpcError }
      return { data: fn === 'create_organization' ? 'org-id' : 'snapshot-id', error: null }
    },
  }
  return { client: client as unknown as MjSupabaseClient, calls }
}

export function fakeSession(email = 'owner@example.invalid'): Session {
  return {
    access_token: 'test',
    refresh_token: 'test',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-01T00:00:00Z',
    },
  } as Session
}

export const ORG_MEMBERSHIP = [{ role: 'owner', organization_id: 'org-1', organizations: { name: 'MJ' } }]
