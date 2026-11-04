import { z } from 'zod'

/**
 * フロントエンドの環境変数を検証する。
 *
 * Vite は `VITE_` で始まる変数だけをブラウザ用バンドルに埋め込む。
 * つまり VITE_ 変数は「公開される前提」の値であり、ここに置いてよいのは
 * Supabase の URL と anon（publishable）キーだけ。
 * service_role キーや OpenAI APIキーを誤って入れた場合は、起動時に拒否する。
 */

export type SupabaseEnv =
  | { status: 'configured'; url: string; anonKey: string }
  | { status: 'missing' }
  | { status: 'invalid'; reason: string }

const urlSchema = z.url({ protocol: /^https?$/ })

/** JWT形式のキーから role クレームを取り出す（署名検証はしない。誤設定検出のためだけ） */
function jwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const payload: unknown = JSON.parse(json)
    if (payload && typeof payload === 'object' && 'role' in payload && typeof payload.role === 'string') {
      return payload.role
    }
  } catch {
    return null
  }
  return null
}

export function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true // 新形式の secret key
  if (key.startsWith('sk-')) return true // OpenAI 等のシークレットキー
  return jwtRole(key) === 'service_role' // 旧形式の service_role JWT
}

export function parseSupabaseEnv(raw: { url?: string | undefined; anonKey?: string | undefined }): SupabaseEnv {
  const url = raw.url?.trim() ?? ''
  const anonKey = raw.anonKey?.trim() ?? ''
  if (!url && !anonKey) return { status: 'missing' }
  if (!url || !anonKey) {
    return { status: 'invalid', reason: 'VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY の両方を設定してください。' }
  }
  if (!urlSchema.safeParse(url).success) {
    return { status: 'invalid', reason: 'VITE_SUPABASE_URL がURLの形式ではありません。' }
  }
  if (looksLikeSecretKey(anonKey)) {
    return {
      status: 'invalid',
      reason:
        'シークレットキー（service_role / sb_secret_ / sk-）が設定されています。フロントエンドには anon（publishable）キーのみを設定してください。',
    }
  }
  return { status: 'configured', url, anonKey }
}

export const supabaseEnv: SupabaseEnv = parseSupabaseEnv({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
})

/** 開発用サンプルデータの表示フラグ（本番では必ず false） */
export const appEnvironment: 'development' | 'production' = import.meta.env.PROD ? 'production' : 'development'
