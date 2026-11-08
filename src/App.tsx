import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { LocalRepo, SupabaseRepo, type Repo } from './lib/repo'
import type { Student } from './lib/types'
import Dashboard from './pages/Dashboard'
import Ledger from './pages/Ledger'
import Login from './pages/Login'

export interface StudentsState {
  repo: Repo
  students: Student[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

function useStudents(repo: Repo): StudentsState {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setStudents(await repo.list())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [repo])

  useEffect(() => {
    void reload()
  }, [reload])

  return { repo, students, loading, error, reload }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!authReady) return null
  if (supabase && !session) return <Login />
  return <Shell />
}

function Shell() {
  const repo = useMemo<Repo>(() => (supabase ? new SupabaseRepo(supabase) : new LocalRepo()), [])
  const state = useStudents(repo)

  return (
    <div className="shell">
      <nav className="nav" aria-label="メニュー">
        <div className="brand">
          <img src="/logo.png" alt="MJ PC & English School" width={44} height={44} />
          <span>MJ Nexus</span>
        </div>
        <NavLink to="/" end className="nav-link">
          ダッシュボード
        </NavLink>
        <NavLink to="/ledger" className="nav-link">
          体験・入会台帳
        </NavLink>
        {supabase && (
          <button type="button" className="nav-logout" onClick={() => void supabase!.auth.signOut()}>
            ログアウト
          </button>
        )}
      </nav>
      <main className="main">
        {repo.kind === 'local' && (
          <div className="notice">
            Supabase が未接続のため、データはこのブラウザだけに保存されています。講師と共有するには README の手順で接続してください。
          </div>
        )}
        {state.error && <div className="notice notice-error">読み込みに失敗しました：{state.error}</div>}
        <Routes>
          <Route path="/" element={<Dashboard {...state} />} />
          <Route path="/ledger" element={<Ledger {...state} />} />
        </Routes>
      </main>
    </div>
  )
}
