import { type FormEvent, useState } from 'react'
import { ErrorState, LoadingState } from '@/components/states/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { hasRole, useOrgContext } from '@/features/organization/use-org-context'
import { CHANNEL_KIND_LABEL, CHANNEL_KINDS, type ChannelKind } from '@/lib/marketing'
import { PLATFORM_LABEL, PLATFORMS, type SocialPlatform } from '@/lib/social'
import { useCampaigns, useChannels, useCourses, useCreateCampaign, useCreateChannel, useCreateCourse } from './api'

function ChannelsCard() {
  const { canEdit } = useOrgContext()
  const channels = useChannels()
  const create = useCreateChannel()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ChannelKind>('paid_social')
  const [platform, setPlatform] = useState<SocialPlatform | ''>('')
  const [error, setError] = useState<string>()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const c = code.trim().toLowerCase()
    if (!/^[a-z0-9_]{1,40}$/.test(c)) return setError('コードは英小文字・数字・_ で入力してください')
    if (!name.trim()) return setError('名前を入力してください')
    setError(undefined)
    await create
      .mutateAsync({ code: c, name: name.trim(), kind, platform: platform || null })
      .then(() => (setCode(''), setName('')), () => undefined)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>集客チャネル</CardTitle>
        <CardDescription>コードは流入URLの utm_source と一致させると、問い合わせ登録時に自動で選ばれます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {channels.isPending ? (
          <LoadingState rows={2} />
        ) : channels.isError ? (
          <ErrorState description={channels.error.message} />
        ) : (
          <ul className="divide-y rounded-lg border">
            {channels.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {c.name} <code className="ml-1 text-xs text-muted-foreground">{c.code}</code>
                </span>
                <Badge variant="outline">{CHANNEL_KIND_LABEL[c.kind]}</Badge>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={onSubmit} noValidate className="grid gap-2 sm:grid-cols-2">
            <Field label="コード" htmlFor="ch-code">
              <Input id="ch-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" placeholder="instagram_ads" />
            </Field>
            <Field label="名前" htmlFor="ch-name">
              <Input id="ch-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Instagram広告" />
            </Field>
            <Field label="種類" htmlFor="ch-kind">
              <NativeSelect id="ch-kind" value={kind} onChange={(e) => setKind(e.target.value as ChannelKind)}>
                {CHANNEL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {CHANNEL_KIND_LABEL[k]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="SNS（任意）" htmlFor="ch-platform">
              <NativeSelect id="ch-platform" value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform | '')}>
                <option value="">なし</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {(error ?? create.error?.message) && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {error ?? create.error?.message}
              </p>
            )}
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                チャネルを追加
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function CampaignsCard() {
  const { canEdit } = useOrgContext()
  const campaigns = useCampaigns()
  const channels = useChannels()
  const create = useCreateCampaign()
  const [name, setName] = useState('')
  const [utm, setUtm] = useState('')
  const [channelId, setChannelId] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [error, setError] = useState<string>()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const u = utm.trim().toLowerCase()
    if (!name.trim()) return setError('名前を入力してください')
    if (u && !/^[a-z0-9_-]{1,60}$/.test(u)) return setError('utm_campaign は英小文字・数字・_・- で入力してください')
    if (startsOn && endsOn && endsOn < startsOn) return setError('終了日は開始日以降にしてください')
    setError(undefined)
    await create
      .mutateAsync({
        name: name.trim(),
        utm_campaign: u || null,
        channel_id: channelId || null,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
      })
      .then(() => (setName(''), setUtm('')), () => undefined)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>キャンペーン</CardTitle>
        <CardDescription>期間限定の施策（体験会・冬期講習の告知など）。utm_campaign で流入を識別します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {campaigns.isPending ? (
          <LoadingState rows={2} />
        ) : campaigns.isError ? (
          <ErrorState description={campaigns.error.message} />
        ) : campaigns.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ登録されていません。</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {campaigns.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {c.name} {c.utm_campaign && <code className="ml-1 text-xs text-muted-foreground">{c.utm_campaign}</code>}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {c.starts_on ?? '—'} 〜 {c.ends_on ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={onSubmit} noValidate className="grid gap-2 sm:grid-cols-2">
            <Field label="名前" htmlFor="cp-name">
              <Input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </Field>
            <Field label="utm_campaign（任意）" htmlFor="cp-utm">
              <Input id="cp-utm" value={utm} onChange={(e) => setUtm(e.target.value)} className="font-mono" placeholder="winter_trial" />
            </Field>
            <Field label="チャネル（任意）" htmlFor="cp-channel">
              <NativeSelect id="cp-channel" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">なし</option>
                {channels.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="開始日" htmlFor="cp-start">
                <Input id="cp-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </Field>
              <Field label="終了日" htmlFor="cp-end">
                <Input id="cp-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </Field>
            </div>
            {(error ?? create.error?.message) && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {error ?? create.error?.message}
              </p>
            )}
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                キャンペーンを追加
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function CoursesCard() {
  const { role } = useOrgContext()
  const isAdmin = hasRole(role, 'admin')
  const courses = useCourses()
  const create = useCreateCourse()
  const [name, setName] = useState('')
  const [fee, setFee] = useState('')
  const [error, setError] = useState<string>()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = Number(fee)
    if (!name.trim()) return setError('コース名を入力してください')
    if (!fee.trim() || !Number.isInteger(n) || n < 0) return setError('月謝を0以上の整数（円）で入力してください')
    setError(undefined)
    await create.mutateAsync({ name: name.trim(), monthly_fee_jpy: n }).then(() => (setName(''), setFee('')), () => undefined)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>コース</CardTitle>
        <CardDescription>入会の記録に使います。契約には入会時点の月謝を保存するため、後で月謝を変えても過去の契約は変わりません。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {courses.isPending ? (
          <LoadingState rows={2} />
        ) : courses.isError ? (
          <ErrorState description={courses.error.message} />
        ) : courses.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ登録されていません。</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {courses.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{c.name}</span>
                <span className="tabular-nums text-muted-foreground">月 ¥{c.monthly_fee_jpy.toLocaleString('ja-JP')}</span>
              </li>
            ))}
          </ul>
        )}
        {isAdmin ? (
          <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2">
            <Field label="コース名" htmlFor="course-name" className="min-w-40 flex-1">
              <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="月謝（円）" htmlFor="course-fee" className="w-32">
              <Input id="course-fee" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              追加
            </Button>
            {(error ?? create.error?.message) && (
              <p role="alert" className="w-full text-sm text-destructive">
                {error ?? create.error?.message}
              </p>
            )}
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">コースの追加は管理者以上が行えます。</p>
        )}
      </CardContent>
    </Card>
  )
}

export function SettingsPanel() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChannelsCard />
      <CampaignsCard />
      <CoursesCard />
    </div>
  )
}
