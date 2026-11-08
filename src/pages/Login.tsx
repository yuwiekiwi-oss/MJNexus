import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    if (error) setError('ログインできませんでした。招待されたメールアドレスか確認してください。')
    else setSent(true)
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <img src="/logo.png" alt="MJ PC & English School" width={44} height={44} />
          <span>MJ Nexus</span>
        </div>
        {sent ? (
          <p>{email} にログイン用のリンクを送りました。メールを開いてリンクを押してください。</p>
        ) : (
          <>
            <label className="field">
              <span>メールアドレス</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn btn-primary">
              ログインリンクを送る
            </button>
          </>
        )}
      </form>
    </div>
  )
}
