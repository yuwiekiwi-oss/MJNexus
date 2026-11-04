import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeSupabase, fakeSession, ORG_MEMBERSHIP } from '@/test/fake-supabase'
import { postKpi } from '@/test/fixtures'
import { renderApp } from '@/test/render-app'

const account = { id: 'acc-1', organization_id: 'org-1', platform: 'instagram', handle: 'test_account' }
const post = {
  id: 'p1',
  organization_id: 'org-1',
  account_id: 'acc-1',
  title: 'テスト投稿',
  format: 'reel',
  status: 'published',
  published_at: '2026-11-01T10:00:00Z',
  tracking_code: null,
  theme_id: null,
  cta: null,
  production_minutes: null,
  post_url: null,
}

function connected(tables: Record<string, Record<string, unknown>[]>, role = 'owner') {
  return createFakeSupabase({
    session: fakeSession(),
    memberships: [{ ...ORG_MEMBERSHIP[0]!, role }],
    tables: { social_accounts: [account], content_themes: [], content_ideas: [], ...tables },
  })
}

describe('Social', () => {
  it('Supabase未接続なら、データ画面の代わりに案内を表示する', async () => {
    renderApp('/social')
    expect(await screen.findByText('Supabase未接続のため、この機能はまだ使えません')).toBeInTheDocument()
  })

  it('投稿一覧に最新の実績とエンゲージメント率を表示する', async () => {
    const { client } = connected({ social_post_kpis: [postKpi()] })
    renderApp('/social', client)
    const link = await screen.findByRole('link', { name: 'テスト投稿' })
    const row = link.closest('tr')!
    expect(within(row).getByText('15.0%')).toBeInTheDocument() // ER（リーチ）
    expect(within(row).getByText('24h後 ・ 1回')).toBeInTheDocument()
  })

  it('投稿がなければEmpty Stateを表示する', async () => {
    const { client } = connected({ social_post_kpis: [] })
    renderApp('/social', client)
    expect(await screen.findByText('まだ投稿が登録されていません')).toBeInTheDocument()
  })

  it('ダッシュボードはSNS指標であることと、データ不足なら未検証であることを明示する', async () => {
    const { client } = connected({ social_post_kpis: [postKpi({ snapshot_count: 0, engagement_rate_reach: null })] })
    renderApp('/social?tab=dashboard', client)
    expect(await screen.findByText('ここはSNS分析です')).toBeInTheDocument()
    expect(screen.getAllByText('未検証（データなし）').length).toBeGreaterThan(0)
    expect(screen.getByText('未検証：比較できるデータがありません')).toBeInTheDocument()
    expect(screen.getByText(/\(いいね \+ コメント \+ 保存 \+ シェア\) ÷ リーチ数/)).toBeInTheDocument()
  })

  it('実績の記録: 値・実測0・未取得・非対応を区別して送信する', async () => {
    const { client, calls } = connected({ social_posts: [post], social_post_snapshot_kpis: [] })
    renderApp('/social/posts/p1', client)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '実績を記録' }))
    await user.click(screen.getByRole('button', { name: '24時間後' }))
    await user.type(screen.getByLabelText('再生数'), '1500')
    await user.type(screen.getByLabelText('いいね'), '0')
    await user.click(within(screen.getByRole('radiogroup', { name: '保存の状態' })).getByRole('radio', { name: '未取得' }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'リンククリックの状態' })).getByRole('radio', { name: '非対応' }))
    await user.click(screen.getAllByRole('button', { name: '実績を記録' }).at(-1)!)

    await waitFor(() => expect(calls.rpc).toHaveLength(1))
    expect(calls.rpc[0]).toEqual({
      fn: 'record_post_metrics',
      args: {
        p_post_id: 'p1',
        p_recorded_at: '2026-11-02T10:00:00.000Z',
        p_values: [
          { metric: 'views', status: 'measured', value: 1500 },
          { metric: 'likes', status: 'measured', value: 0 },
          { metric: 'saves', status: 'not_collected', value: null },
          { metric: 'link_clicks', status: 'unsupported', value: null },
        ],
        p_source: 'manual',
        p_note: null,
      },
    })
  })

  it('実績の記録: 何も入力しなければ送信しない', async () => {
    const { client, calls } = connected({ social_posts: [post], social_post_snapshot_kpis: [] })
    renderApp('/social/posts/p1', client)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '実績を記録' }))
    await user.click(screen.getAllByRole('button', { name: '実績を記録' }).at(-1)!)
    expect(await screen.findByText(/指標を1つ以上入力してください/)).toBeInTheDocument()
    expect(calls.rpc).toHaveLength(0)
  })

  it('閲覧者には記録・登録ボタンを出さない', async () => {
    const { client } = connected({ social_posts: [post], social_post_snapshot_kpis: [] }, 'viewer')
    renderApp('/social/posts/p1', client)
    expect(await screen.findByText('まだ実績が記録されていません')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '実績を記録' })).not.toBeInTheDocument()
  })

  it('投稿登録: 公開済みで公開日時がなければ保存しない', async () => {
    const { client, calls } = connected({})
    renderApp('/social/posts/new', client)
    const user = userEvent.setup()
    const select = await screen.findByRole('combobox', { name: /^アカウント/ })
    await screen.findByRole('option', { name: /test_account/ })
    await user.selectOptions(select, 'acc-1')
    await user.type(screen.getByRole('textbox', { name: /^タイトル/ }), '完成動画')
    await user.click(screen.getByRole('button', { name: '登録する' }))
    expect(await screen.findByText('公開済みの投稿は公開日時が必要です')).toBeInTheDocument()
    expect(calls.insert).toHaveLength(0)
  })
})

describe('Content Planner', () => {
  const idea = {
    id: 'i1',
    organization_id: 'org-1',
    title: '小5の脱出ゲーム制作過程',
    status: 'idea',
    platforms: ['tiktok'],
    planned_publish_date: '2026-11-20',
    hypothesis: '制作過程は保存されやすい',
    ai_generated: false,
  }

  it('カンバンに企画を表示し、次のステータスへ進められる', async () => {
    const { client, calls } = connected({ content_ideas: [idea], social_post_kpis: [] })
    renderApp('/content-planner', client)
    const column = await screen.findByRole('region', { name: 'Idea' })
    expect(within(column).getByText('小5の脱出ゲーム制作過程')).toBeInTheDocument()
    await userEvent.setup().click(within(column).getByRole('button', { name: 'Planningへ進める' }))
    await waitFor(() => expect(calls.update).toEqual([{ table: 'content_ideas', values: { status: 'planning' } }]))
  })

  it('企画を開くと、仮説と紐づく投稿の結果を表示する（実績なしは未検証）', async () => {
    const { client } = connected({
      content_ideas: [idea],
      social_post_kpis: [postKpi({ title: '脱出ゲーム投稿', content_idea_id: 'i1', snapshot_count: 0 })],
    })
    renderApp('/content-planner', client)
    await userEvent.setup().click(await screen.findByRole('button', { name: '小5の脱出ゲーム制作過程' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText((_, el) => el?.tagName === 'P' && el.textContent === '仮説: 制作過程は保存されやすい')).toBeInTheDocument()
    expect(within(dialog).getByText('実績未記録（未検証）')).toBeInTheDocument()
  })
})
