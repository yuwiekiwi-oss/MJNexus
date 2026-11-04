import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeSupabase, fakeSession } from '@/test/fake-supabase'
import { renderApp } from '@/test/render-app'

describe('Supabase未接続モード', () => {
  it('Overviewを表示し、未接続であることと実績データがないことを明示する', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText(/Supabase未接続/)).toBeInTheDocument()
    expect(screen.getByText('まだ実績データがありません')).toBeInTheDocument()
  })

  it('サイドバーの未実装メニューに Soon バッジを表示する', async () => {
    renderApp('/')
    const nav = await screen.findByRole('navigation', { name: 'メインメニュー' })
    expect(within(nav).getByRole('link', { name: /Overview/ })).not.toHaveTextContent('Soon')
    expect(within(nav).getByRole('link', { name: /Social/ })).toHaveTextContent('Soon')
    expect(within(nav).getAllByText('Soon')).toHaveLength(10)
  })

  it('未実装ページは Coming Soon と予定フェーズを表示する', async () => {
    renderApp('/marketing')
    expect(await screen.findByRole('heading', { name: 'Marketing' })).toBeInTheDocument()
    expect(screen.getByText(/Coming Soon — Phase 3 で実装予定/)).toBeInTheDocument()
    expect(screen.getByText(/現時点では利用できません/)).toBeInTheDocument()
  })

  it('存在しないURLは Not Found', async () => {
    renderApp('/no-such-page')
    expect(await screen.findByText('ページが見つかりません')).toBeInTheDocument()
  })

  it('Settings で外部サービスを未接続と表示する（推測で接続済みにしない）', async () => {
    renderApp('/settings')
    const openai = await screen.findByText('OpenAI API')
    expect(openai.parentElement).toHaveTextContent('未接続')
  })
})

describe('Supabase接続モード', () => {
  it('未ログインならログイン画面へリダイレクトする', async () => {
    const { client } = createFakeSupabase({ session: null })
    const { router } = renderApp('/social', client)
    expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('ログイン画面で不正なメールアドレスは送信しない', async () => {
    const { client, calls } = createFakeSupabase({ session: null })
    renderApp('/login', client)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('メールアドレス'), 'not-an-email')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('有効なメールアドレス')
    expect(calls.signInWithPassword).toBe(0)
  })

  it('認証エラーは日本語メッセージで表示する', async () => {
    const { client } = createFakeSupabase({ session: null, signInError: 'Invalid login credentials' })
    renderApp('/login', client)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('メールアドレス'), 'a@example.invalid')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('メールアドレスまたはパスワードが正しくありません')
  })

  it('ログイン済みで組織がなければ組織作成画面を表示する', async () => {
    const { client } = createFakeSupabase({ session: fakeSession(), memberships: [] })
    renderApp('/', client)
    expect(await screen.findByText('スクールを作成')).toBeInTheDocument()
  })

  it('ログイン済みで組織があればOverviewと所属・権限を表示する', async () => {
    const { client } = createFakeSupabase({
      session: fakeSession(),
      memberships: [{ role: 'owner', organization_id: 'org-1', organizations: { name: 'MJ' } }],
    })
    renderApp('/', client)
    await waitFor(() => expect(screen.getByText('MJ ・ オーナー')).toBeInTheDocument())
    expect(screen.queryByText(/Supabase未接続/)).not.toBeInTheDocument()
  })
})
