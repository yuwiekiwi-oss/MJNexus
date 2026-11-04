import { Hexagon, KeyRound, LoaderCircle, Mail, PlugZap } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from './auth-context'

const emailSchema = z.email({ error: '有効なメールアドレスを入力してください。' })
const passwordSchema = z.string().min(8, { error: 'パスワードは8文字以上です。' })

type Mode = 'password' | 'magic_link'

export function LoginPage() {
  const { state, signInWithPassword, sendMagicLink } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (state.status === 'signed_in' || state.status === 'unconfigured') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    const parsedEmail = emailSchema.safeParse(email.trim())
    if (!parsedEmail.success) return setError(parsedEmail.error.issues[0]?.message ?? '入力内容を確認してください。')
    if (mode === 'password') {
      const parsedPw = passwordSchema.safeParse(password)
      if (!parsedPw.success) return setError(parsedPw.error.issues[0]?.message ?? '入力内容を確認してください。')
    }
    setSubmitting(true)
    const result =
      mode === 'password'
        ? await signInWithPassword(parsedEmail.data, password)
        : await sendMagicLink(parsedEmail.data)
    setSubmitting(false)
    if (result.error) setError(result.error)
    else if (mode === 'magic_link') setInfo('ログイン用のリンクをメールで送信しました。')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Hexagon className="size-4" />
          </div>
          <span className="text-lg font-semibold">MJ Nexus</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ログイン</CardTitle>
            <CardDescription>招待されたメールアドレスでログインしてください。</CardDescription>
          </CardHeader>
          <CardContent>
            {state.status === 'loading' ? (
              <div className="flex justify-center py-6" role="status">
                <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
                <span className="sr-only">読み込み中…</span>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {mode === 'password' && (
                  <div className="space-y-2">
                    <Label htmlFor="password">パスワード</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {info && <p className="text-sm text-success">{info}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <LoaderCircle className="animate-spin" />}
                  {mode === 'password' ? 'ログイン' : 'ログインリンクを送信'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    setMode(mode === 'password' ? 'magic_link' : 'password')
                    setError(null)
                    setInfo(null)
                  }}
                >
                  {mode === 'password' ? <Mail /> : <KeyRound />}
                  {mode === 'password' ? 'メールのリンクでログイン' : 'パスワードでログイン'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <Alert className="mt-4" role="note">
          <PlugZap />
          <AlertTitle>新規登録について</AlertTitle>
          <AlertDescription>
            未成年の情報を扱うため、アカウントは招待制です。管理者がSupabaseの管理画面から招待します。
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
