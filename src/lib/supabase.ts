import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { supabaseEnv } from './env'

export type MjSupabaseClient = SupabaseClient<Database>

/**
 * Supabase クライアント（ブラウザ用）。
 * 環境変数が未設定・不正な場合は null。呼び出し側は「未接続」として扱う。
 * anon キーは公開されても問題ない設計（実際のアクセス制御は RLS が担う）。
 */
export const supabase: MjSupabaseClient | null =
  supabaseEnv.status === 'configured'
    ? createClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null
