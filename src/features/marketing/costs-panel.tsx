import { Lock, Wallet } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { hasRole, useOrgContext } from '@/features/organization/use-org-context'
import { EXPENSE_CATEGORY_LABEL, MARKETING_EXPENSE_CATEGORIES, type MarketingExpenseCategory, todayJst } from '@/lib/marketing'
import { useCampaigns, useChannels, useCosts, useCreateCost } from './api'

/** 集客費用（費用台帳 expense_transactions のうち、広告費・キャンペーン費・制作外注費） */
export function CostsPanel() {
  const { role } = useOrgContext()
  const isAdmin = hasRole(role, 'admin')
  const costs = useCosts()
  const channels = useChannels()
  const campaigns = useCampaigns()
  const create = useCreateCost()
  const [date, setDate] = useState(() => todayJst())
  const [category, setCategory] = useState<MarketingExpenseCategory>('ad_spend')
  const [amount, setAmount] = useState('')
  const [channelId, setChannelId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string>()

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="集客費用は管理者以上が閲覧・登録できます"
        description="費用は財務データのため権限を分けています。ファネルの CPA・CAC も、権限がない場合は「権限なし」と表示します。"
      />
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('日付を入力してください')
    if (!Number.isInteger(n) || n <= 0) return setError('金額は1円以上の整数で入力してください')
    setError(undefined)
    await create
      .mutateAsync({
        occurred_on: date,
        category,
        amount_jpy: n,
        channel_id: channelId || null,
        campaign_id: campaignId || null,
        description: description.trim() || null,
      })
      .then(() => (setAmount(''), setDescription('')), () => undefined)
  }

  const name = (list: { id: string; name: string }[] | undefined, id: string | null) => list?.find((x) => x.id === id)?.name ?? '—'

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <Card>
        <CardHeader>
          <CardTitle>集客費用を登録</CardTitle>
          <CardDescription>
            費用台帳（Finance と共通）に保存します。同じ費用を二重に入力しないよう、広告費はここか Finance のどちらか一方で登録してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-2">
            <Field label="日付" htmlFor="cost-date">
              <Input id="cost-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="区分" htmlFor="cost-category">
              <NativeSelect id="cost-category" value={category} onChange={(e) => setCategory(e.target.value as MarketingExpenseCategory)}>
                {MARKETING_EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="金額（円）" htmlFor="cost-amount">
              <Input id="cost-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="チャネル" htmlFor="cost-channel" hint="チャネル別のCPA・CACに使います">
              <NativeSelect id="cost-channel" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">未設定</option>
                {channels.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="キャンペーン（任意）" htmlFor="cost-campaign">
              <NativeSelect id="cost-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">なし</option>
                {campaigns.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="内容（任意）" htmlFor="cost-desc">
              <Input id="cost-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
            </Field>
            {(error ?? create.error?.message) && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {error ?? create.error?.message}
              </p>
            )}
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                登録する
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>登録済みの集客費用</CardTitle>
        </CardHeader>
        {costs.isPending ? (
          <CardContent>
            <LoadingState rows={3} />
          </CardContent>
        ) : costs.isError ? (
          <CardContent>
            <ErrorState description={costs.error.message} />
          </CardContent>
        ) : costs.data.length === 0 ? (
          <CardContent className="pb-6">
            <EmptyState icon={<Wallet className="size-5" />} title="まだ費用が記録されていません" description="費用がない期間のCPA・CACは「費用未記録」と表示します（0円とはみなしません）。" />
          </CardContent>
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[520px] text-sm tabular-nums">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">日付</th>
                  <th className="px-3 py-2 font-medium">区分</th>
                  <th className="px-3 py-2 font-medium">チャネル</th>
                  <th className="px-3 py-2 font-medium">内容</th>
                  <th className="px-4 py-2 text-right font-medium">金額</th>
                </tr>
              </thead>
              <tbody>
                {costs.data.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-2 whitespace-nowrap">{c.occurred_on}</td>
                    <td className="px-3 py-2">{EXPENSE_CATEGORY_LABEL[c.category]}</td>
                    <td className="px-3 py-2">{name(channels.data, c.channel_id)}</td>
                    <td className="max-w-48 truncate px-3 py-2 text-muted-foreground">{c.description ?? (c.campaign_id ? name(campaigns.data, c.campaign_id) : '')}</td>
                    <td className="px-4 py-2 text-right">¥{c.amount_jpy.toLocaleString('ja-JP')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
