import type { Session, User } from '@supabase/supabase-js'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { MjSupabaseClient } from '@/lib/supabase'

/**
 * 認証状態
 *   unconfigured : Supabase未接続（環境変数なし）。データは一切扱わない
 *   loading      : セッション確認中
 *   signed_out   : 未ログイン
 *   signed_in    : ログイン済み
 */
export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session; user: User }

interface AuthContextValue {
  state: AuthState
  client: MjSupabaseClient | null
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Supabaseのエラーをユーザー向けの日本語に変換（詳細はログに出さない） */
// oxlint-disable-next-line react/only-export-components
export function toAuthErrorMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません。'
  if (m.includes('email not confirmed')) return 'メールアドレスの確認が完了していません。'
  if (m.includes('signups not allowed') || m.includes('signup')) return 'このメールアドレスは招待されていません。管理者に連絡してください。'
  if (m.includes('rate limit')) return '試行回数が多すぎます。しばらく待ってから再度お試しください。'
  return 'ログインに失敗しました。時間をおいて再度お試しください。'
}

export function AuthProvider({ client, children }: { client: MjSupabaseClient | null; children: ReactNode }) {
  const [state, setState] = useState<AuthState>(client ? { status: 'loading' } : { status: 'unconfigured' })

  useEffect(() => {
    if (!client) return
    let active = true
    const apply = (session: Session | null) => {
      if (!active) return
      setState(session ? { status: 'signed_in', session, user: session.user } : { status: 'signed_out' })
    }
    client.auth.getSession().then(({ data }) => apply(data.session))
    const { data } = client.auth.onAuthStateChange((_event, session) => apply(session))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      client,
      async signInWithPassword(email, password) {
        if (!client) return { error: 'Supabaseが未接続です。' }
        const { error } = await client.auth.signInWithPassword({ email, password })
        return { error: error ? toAuthErrorMessage(error.message) : null }
      },
      async sendMagicLink(email) {
        if (!client) return { error: 'Supabaseが未接続です。' }
        const { error } = await client.auth.signInWithOtp({
          email,
          // 招待制: 未登録メールで新規ユーザーを作らない
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
        })
        return { error: error ? toAuthErrorMessage(error.message) : null }
      },
      async signOut() {
        await client?.auth.signOut()
      },
    }),
    [state, client],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
