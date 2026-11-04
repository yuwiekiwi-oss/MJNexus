import type { Session } from '@supabase/supabase-js'
import type { MjSupabaseClient } from '@/lib/supabase'

/**
 * テスト用の最小限の Supabase クライアント。
 * 実ネットワークに接続せず、認証状態とクエリ結果を差し替えられる。
 */
export function createFakeSupabase(opts: {
  session?: Session | null
  memberships?: { role: string; organization_id: string; organizations: { name: string } | null }[]
  signInError?: string | null
}) {
  const calls = { signInWithPassword: 0 }
  const query = {
    select: () => query,
    eq: () => query,
    order: async () => ({ data: opts.memberships ?? [], error: null }),
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
    from: () => query,
    rpc: async () => ({ data: 'org-id', error: null }),
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
