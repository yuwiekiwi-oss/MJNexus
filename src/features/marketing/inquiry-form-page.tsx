import { ArrowLeft, LoaderCircle, ShieldAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { DataGate } from '@/components/data-gate'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { hasRole, useOrgContext } from '@/features/organization/use-org-context'
import { toLocalInput } from '@/lib/format'
import {
  ATTRIBUTION_HINT,
  ATTRIBUTION_LABEL,
  ATTRIBUTIONS,
  type AttributionMethod,
  GRADES,
  gradeLabel,
  looksLikePii,
  parseLanding,
} from '@/lib/marketing'
import { useCampaigns, useChannels, useCreateInquiry } from './api'
import { buildInquiry, initialInquiryValues, type InquiryFormValues } from './inquiry-form-model'

function InquiryForm() {
  const navigate = useNavigate()
  const { role, canEdit } = useOrgContext()
  const isAdmin = hasRole(role, 'admin')
  const channels = useChannels()
  const campaigns = useCampaigns()
  const create = useCreateInquiry()
  const [values, setValues] = useState<InquiryFormValues>(() => initialInquiryValues(toLocalInput(new Date().toISOString())))
  const [errors, setErrors] = useState<Record<string, string>>({})
  // 「反映」を押した時点の流入URLだけを使う（入力途中のURLで追跡リンク扱いにしない）
  const [landing, setLanding] = useState<ReturnType<typeof parseLanding>>(null)

  const set = (k: keyof InquiryFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }))

  /** 流入URLを反映: チャネル（utm_source = チャネルのコード）・キャンペーン・確度 */
  function applyLanding() {
    const parsed = parseLanding(values.landing_url)
    setLanding(parsed)
    if (!parsed) return setErrors((e) => ({ ...e, landing_url: 'UTMパラメータが見つかりません' }))
    const ch = channels.data?.find((c) => c.code === parsed.utm_source)
    const cp = campaigns.data?.find((c) => c.utm_campaign && c.utm_campaign === parsed.utm_campaign)
    setErrors(({ landing_url: _drop, ...rest }) => rest)
    setValues((v) => ({
      ...v,
      channel_id: ch?.id ?? v.channel_id,
      campaign_id: cp?.id ?? v.campaign_id,
      attribution: 'tracked_link',
    }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const r = buildInquiry(values, {
      landing,
      includeContact: isAdmin,
    })
    if (!r.ok) return setErrors(r.errors)
    setErrors({})
    const res = await create.mutateAsync({ values: r.values, contact: r.contact }).catch(() => null)
    if (res) navigate(`/marketing/inquiries/${res.id}`, { state: res.contactError ? { contactError: res.contactError } : undefined })
  }

  const piiWarning = looksLikePii(values.notes)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>きっかけ</CardTitle>
          <CardDescription>
            問い合わせフォームに流入URLが残っていれば貼り付けて「反映」を押してください。UTMからチャネルとキャンペーンを選び、確度を「追跡リンク」（確度が高い）にします。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="問い合わせ日時（日本時間）" htmlFor="inquired_at" required error={errors.inquired_at}>
            <Input id="inquired_at" type="datetime-local" value={values.inquired_at} onChange={set('inquired_at')} />
          </Field>
          <Field label="流入URL（任意）" htmlFor="landing_url" error={errors.landing_url} hint="utm_source・utm_campaign・utm_content を読み取ります">
            <div className="flex gap-2">
              <Input
                id="landing_url"
                value={values.landing_url}
                onChange={(e) => {
                  set('landing_url')(e)
                  setLanding(null)
                }} placeholder="https://…?utm_source=instagram&utm_content=…" />
              <Button type="button" variant="outline" onClick={applyLanding} disabled={!values.landing_url.trim()}>
                反映
              </Button>
            </div>
          </Field>
          {landing && (
            <p className="text-sm text-muted-foreground sm:col-span-2" aria-live="polite">
              読み取ったUTM: {[landing.utm_source, landing.utm_medium, landing.utm_campaign, landing.utm_content].filter(Boolean).join(' / ')}
            </p>
          )}
          <Field label="チャネル" htmlFor="channel_id">
            <NativeSelect id="channel_id" value={values.channel_id} onChange={set('channel_id')}>
              <option value="">未設定</option>
              {channels.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="キャンペーン" htmlFor="campaign_id">
            <NativeSelect id="campaign_id" value={values.campaign_id} onChange={set('campaign_id')}>
              <option value="">なし</option>
              {campaigns.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="きっかけの確度" htmlFor="attribution" error={errors.attribution} hint={ATTRIBUTION_HINT[values.attribution]}>
            <NativeSelect id="attribution" value={values.attribution} onChange={(e) => setValues((v) => ({ ...v, attribution: e.target.value as AttributionMethod }))}>
              {ATTRIBUTIONS.map((a) => (
                <option key={a} value={a}>
                  {ATTRIBUTION_LABEL[a]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>お子さまの情報とメモ</CardTitle>
          <CardDescription>氏名・学校名・住所などは記録しません。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="学年" htmlFor="child_grade" error={errors.child_grade}>
            <NativeSelect id="child_grade" value={values.child_grade} onChange={set('child_grade')}>
              <option value="">不明</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="メモ"
            htmlFor="notes"
            error={errors.notes}
            hint="興味のあること、問い合わせの内容など。個人を特定できる情報は書かないでください"
            className="sm:col-span-2"
          >
            <Textarea id="notes" value={values.notes} onChange={set('notes')} rows={3} maxLength={500} />
          </Field>
          {piiWarning && (
            <Alert role="note" className="sm:col-span-3">
              <ShieldAlert />
              <AlertDescription>メモにメールアドレスや電話番号のような文字列があります。連絡先は下の「連絡先」欄（管理者のみ閲覧）に入力してください。</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>連絡先（任意）</CardTitle>
            <CardDescription>管理者以上だけが閲覧できる別のテーブルに保存します。集計には使いません。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="保護者の呼び名" htmlFor="guardian_name" error={errors.guardian_name}>
              <Input id="guardian_name" value={values.guardian_name} onChange={set('guardian_name')} maxLength={50} placeholder="例: 山田さん" />
            </Field>
            <Field label="メールアドレス" htmlFor="email" error={errors.email}>
              <Input id="email" type="email" value={values.email} onChange={set('email')} />
            </Field>
            <Field label="電話番号" htmlFor="phone" error={errors.phone}>
              <Input id="phone" type="tel" value={values.phone} onChange={set('phone')} />
            </Field>
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">連絡先は管理者以上のみ登録・閲覧できます。</p>
      )}

      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {create.error.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          キャンセル
        </Button>
        <Button type="submit" disabled={create.isPending || !canEdit}>
          {create.isPending && <LoaderCircle className="animate-spin" />}
          登録する
        </Button>
      </div>
      {!canEdit && <p className="text-right text-xs text-muted-foreground">閲覧者は問い合わせを登録できません。</p>}
    </form>
  )
}

export function InquiryFormPage() {
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/marketing">
          <ArrowLeft /> 戻る
        </Link>
      </Button>
      <PageHeader title="問い合わせを登録" description="必須は問い合わせ日時だけです。きっかけが分からなければ「不明」のままで構いません。" />
      <DataGate>
        <InquiryForm />
      </DataGate>
    </>
  )
}
