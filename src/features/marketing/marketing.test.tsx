import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { FunnelRow } from '@/lib/marketing'
import { createFakeSupabase, fakeSession, ORG_MEMBERSHIP } from '@/test/fake-supabase'
import { renderApp } from '@/test/render-app'
import { trialStatusUpdate } from './api'
import { buildInquiry, initialInquiryValues } from './inquiry-form-model'

// テスト専用の架空データ（画面やDBの初期データには使わない）
const channels = [
  { id: 'ch-ig', organization_id: 'org-1', code: 'instagram', name: 'Instagram', kind: 'organic_social', platform: 'instagram' },
  { id: 'ch-tt', organization_id: 'org-1', code: 'tiktok', name: 'TikTok', kind: 'organic_social', platform: 'tiktok' },
]
const post = { id: 'p1', organization_id: 'org-1', account_id: 'acc-1', title: 'テスト投稿', tracking_code: 'ab12cd' }

function pipelineRow(o: Record<string, unknown> = {}) {
  return {
    id: 'inq-1',
    organization_id: 'org-1',
    inquired_at: '2026-09-01T01:00:00Z',
    channel_id: 'ch-ig',
    channel_name: 'Instagram',
    campaign_id: null,
    campaign_name: null,
    social_post_id: 'p1',
    post_title: 'テスト投稿',
    tracking_code: 'ab12cd',
    attribution: 'tracked_link',
    utm_source: 'instagram',
    utm_medium: 'social',
    utm_campaign: null,
    utm_content: 'ab12cd',
    child_grade: 4,
    closed_lost_at: null,
    closed_lost_reason: null,
    notes: null,
    trial_count: 1,
    attended_count: 1,
    next_trial_at: null,
    enrollment_visible: true,
    enrolled_on: null,
    stage: 'trial_attended',
    ...o,
  }
}

function funnelRow(o: Partial<FunnelRow> = {}): FunnelRow {
  return {
    group_key: 'all',
    group_label: '全体',
    inquiries: 4,
    tracked_inquiries: 1,
    trial_booked: 3,
    trial_attended: 2,
    enrolled: 2,
    closed_lost: 1,
    open_recent: 0,
    median_days_to_enroll: 12,
    cost_jpy: 8000,
    cost_visible: true,
    ...o,
  }
}

function connected(role: string, extra: Parameters<typeof createFakeSupabase>[0] = {}) {
  return createFakeSupabase({
    session: fakeSession(),
    memberships: [{ ...ORG_MEMBERSHIP[0]!, role }],
    ...extra,
    tables: {
      marketing_channels: channels,
      campaigns: [],
      courses: [{ id: 'course-1', organization_id: 'org-1', name: 'スタンダード', monthly_fee_jpy: 12000 }],
      social_posts: [post],
      social_post_kpis: [],
      inquiry_pipeline: [],
      trial_lessons: [],
      inquiry_contacts: [],
      enrollments: [],
      ...extra.tables,
    },
  })
}

describe('Marketing: 問い合わせ一覧', () => {
  it('Supabase未接続なら案内を表示する', async () => {
    renderApp('/marketing')
    expect(await screen.findByText('Supabase未接続のため、この機能はまだ使えません')).toBeInTheDocument()
  })

  it('問い合わせがなければEmpty Stateを表示する', async () => {
    const { client } = connected('editor')
    renderApp('/marketing', client)
    expect(await screen.findByText('まだ問い合わせが登録されていません')).toBeInTheDocument()
  })

  it('進捗と紐づけの確度を表示し、閲覧者には入会状況を「権限なし」と表示する（未入会と誤表示しない）', async () => {
    const { client } = connected('viewer', {
      tables: { inquiry_pipeline: [pipelineRow({ stage: null, enrollment_visible: false, attribution: 'self_reported' })] },
    })
    renderApp('/marketing', client)
    const row = (await screen.findByText('テスト投稿')).closest('tr')!
    expect(within(row).getByText('権限なし')).toBeInTheDocument()
    expect(within(row).getByText('本人の回答（参考）')).toBeInTheDocument()
  })
})

describe('Marketing: ファネル', () => {
  it('件数から率・CPA・CACを表示し、経営指標であることを明示する', async () => {
    const { client, calls } = connected('owner', { rpcData: { marketing_funnel: [funnelRow()] } })
    renderApp('/marketing?tab=funnel', client)
    expect(await screen.findByText('ここは経営分析です')).toBeInTheDocument()
    const table = await screen.findByRole('table')
    const row = within(table).getByText('全体').closest('tr')!
    expect(within(row).getByText('（75.0%）')).toBeInTheDocument() // 体験申込率 3/4
    expect(within(row).getByText('（50.0%）')).toBeInTheDocument() // 入会 2/4
    expect(within(row).getByText('¥2,000')).toBeInTheDocument() // CPA 8000/4
    expect(within(row).getByText('¥4,000')).toBeInTheDocument() // CAC 8000/2
    expect(within(row).getByText('12日')).toBeInTheDocument()
    expect(calls.rpc.find((c) => c.fn === 'marketing_funnel')?.args).toMatchObject({ p_org: 'org-1', p_group: 'total' })
  })

  it('費用が未記録なら CPA を0円にせず「費用未記録」と表示する', async () => {
    const { client } = connected('owner', { rpcData: { marketing_funnel: [funnelRow({ cost_jpy: null })] } })
    renderApp('/marketing?tab=funnel', client)
    const table = await screen.findByRole('table')
    expect(within(table).getAllByText('費用未記録')).toHaveLength(3)
  })

  it('問い合わせ0件なら「未検証」のEmpty Stateを出す', async () => {
    const { client } = connected('owner', { rpcData: { marketing_funnel: [] } })
    renderApp('/marketing?tab=funnel', client)
    expect(await screen.findByText('未検証：この期間の問い合わせがありません')).toBeInTheDocument()
  })

  it('閲覧者には集計を表示せず、RPCも呼ばない', async () => {
    const { client, calls } = connected('viewer')
    renderApp('/marketing?tab=funnel', client)
    expect(await screen.findByText('集客ファネルは編集者以上が閲覧できます')).toBeInTheDocument()
    expect(calls.rpc.some((c) => c.fn === 'marketing_funnel')).toBe(false)
  })

  it('編集者には費用を「権限なし」と表示する', async () => {
    const { client } = connected('editor', { rpcData: { marketing_funnel: [funnelRow({ cost_jpy: null, cost_visible: false })] } })
    renderApp('/marketing?tab=funnel', client)
    const table = await screen.findByRole('table')
    expect(within(table).getAllByText('権限なし')).toHaveLength(3)
  })
})

describe('Marketing: 問い合わせの登録', () => {
  it('流入URLを反映すると、チャネルと追跡コードの投稿を照合し「追跡リンク」で保存する', async () => {
    const { client, calls } = connected('editor')
    renderApp('/marketing/inquiries/new', client)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('流入URL（任意）'), 'https://mj.example/?utm_source=instagram&utm_content=ab12cd')
    await user.click(screen.getByRole('button', { name: '反映' }))
    expect(await screen.findByText('テスト投稿')).toBeInTheDocument()
    expect(screen.getByLabelText('紐づけの確度')).toHaveValue('tracked_link')
    expect(screen.getByLabelText('チャネル')).toHaveValue('ch-ig')
    // 編集者には連絡先欄を出さない
    expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '登録する' }))
    await waitFor(() => expect(calls.insert.find((c) => c.table === 'inquiries')).toBeDefined())
    expect(calls.insert.find((c) => c.table === 'inquiries')?.values).toMatchObject({
      organization_id: 'org-1',
      channel_id: 'ch-ig',
      social_post_id: 'p1',
      attribution: 'tracked_link',
      utm_source: 'instagram',
      utm_content: 'ab12cd',
    })
  })

  it('メモに連絡先らしき文字列があれば注意を出す', async () => {
    const { client } = connected('owner')
    renderApp('/marketing/inquiries/new', client)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('メモ'), '090-1234-5678 に折り返し')
    expect(screen.getByText(/メールアドレスや電話番号のような文字列があります/)).toBeInTheDocument()
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument() // 管理者には連絡先欄を出す
  })
})

describe('Marketing: 問い合わせ詳細', () => {
  it('管理者は入会を記録できる（生徒と契約を1回のRPCで作成）', async () => {
    const { client, calls } = connected('admin', {
      tables: { inquiry_pipeline: [pipelineRow()] },
    })
    renderApp('/marketing/inquiries/inq-1', client)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/生徒の呼び名/), 'はなこ')
    await user.selectOptions(screen.getByLabelText(/コース/), 'course-1')
    await user.clear(screen.getByLabelText(/入会日/))
    await user.type(screen.getByLabelText(/入会日/), '2026-09-15')
    await user.click(screen.getByRole('button', { name: '入会を記録' }))
    await waitFor(() => expect(calls.rpc.find((c) => c.fn === 'record_enrollment')).toBeDefined())
    expect(calls.rpc.find((c) => c.fn === 'record_enrollment')?.args).toEqual({
      p_inquiry_id: 'inq-1',
      p_display_name: 'はなこ',
      p_grade: 4,
      p_course_id: 'course-1',
      p_enrolled_on: '2026-09-15',
      p_monthly_fee_jpy: null,
    })
  })

  it('編集者には入会の記録フォームを出さない', async () => {
    const { client } = connected('editor', { tables: { inquiry_pipeline: [pipelineRow()] } })
    renderApp('/marketing/inquiries/inq-1', client)
    expect(await screen.findByText('入会の記録は管理者以上が行えます。')).toBeInTheDocument()
  })
})

describe('フォームのルール', () => {
  const now = new Date('2026-11-04T03:00:00Z')
  it('追跡リンクは投稿を照合できた場合だけ選べる', () => {
    const v = { ...initialInquiryValues('2026-11-04T10:00'), attribution: 'tracked_link' as const }
    const r = buildInquiry(v, { landing: null, trackedPostId: null, includeContact: false, now })
    expect(r.ok).toBe(false)
  })

  it('未来の問い合わせ日時と不正な連絡先は拒否する', () => {
    const v = { ...initialInquiryValues('2026-11-10T10:00'), guardian_name: '', email: 'bad' }
    const r = buildInquiry(v, { landing: null, trackedPostId: null, includeContact: true, now })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['email', 'guardian_name', 'inquired_at'])
  })

  it('連絡先は管理者のときだけ送る', () => {
    const v = { ...initialInquiryValues('2026-11-04T10:00'), guardian_name: '山田さん' }
    const r = buildInquiry(v, { landing: null, trackedPostId: null, includeContact: false, now })
    expect(r.ok && r.contact).toBe(null)
  })

  it('体験の状態に合わせて参加日時・キャンセル日時を入れる（DBの制約と一致）', () => {
    expect(trialStatusUpdate('attended', '2026-09-08T07:00:00Z', now)).toEqual({
      status: 'attended',
      attended_at: '2026-09-08T07:00:00Z',
      cancelled_at: null,
    })
    expect(trialStatusUpdate('cancelled', 'x', now).cancelled_at).toBe(now.toISOString())
    expect(trialStatusUpdate('no_show', 'x', now)).toMatchObject({ attended_at: null, cancelled_at: null })
  })
})
