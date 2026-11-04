import { ArrowLeft, LoaderCircle, Lock } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { DomainBadge } from '@/components/analysis-badges'
import { DataGate } from '@/components/data-gate'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { hasRole, useOrgContext } from '@/features/organization/use-org-context'
import { dateTimeText, fromLocalInput, toLocalInput } from '@/features/social/format'
import { GRADES, gradeLabel, TRIAL_STATUS_LABEL, type TrialStatus } from '@/lib/marketing'
import type { EnrollmentRow, InquiryPipelineRow, TrialLessonRow } from '@/types/database'
import { useAddTrial, useCourses, useInquiry, useRecordEnrollment, useSetLost, useUpdateTrialStatus } from './api'
import { AttributionBadge, StageBadge } from './marketing-badges'

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

function Summary({ inq }: { inq: InquiryPipelineRow }) {
  const rows: [string, React.ReactNode][] = [
    ['問い合わせ日時', dateTimeText(inq.inquired_at)],
    ['チャネル', inq.channel_name ?? '未設定'],
    ['キャンペーン', inq.campaign_name ?? 'なし'],
    ['紐づけの確度', <AttributionBadge key="a" value={inq.attribution} />],
    [
      '関連投稿',
      inq.social_post_id ? (
        <Link key="p" to={`/social/posts/${inq.social_post_id}`} className="hover:underline">
          {inq.post_title}
        </Link>
      ) : (
        'なし'
      ),
    ],
    ['学年', gradeLabel(inq.child_grade)],
    ['UTM', [inq.utm_source, inq.utm_medium, inq.utm_campaign, inq.utm_content].filter(Boolean).join(' / ') || 'なし'],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          概要 <StageBadge stage={inq.stage} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        {inq.notes && <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">{inq.notes}</p>}
      </CardContent>
    </Card>
  )
}

function TrialsCard({ inquiryId, trials, canEdit }: { inquiryId: string; trials: TrialLessonRow[]; canEdit: boolean }) {
  const add = useAddTrial(inquiryId)
  const update = useUpdateTrialStatus()
  const [scheduled, setScheduled] = useState('')
  const [error, setError] = useState<string>()

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const at = fromLocalInput(scheduled)
    if (!at) return setError('体験の日時を入力してください')
    setError(undefined)
    await add.mutateAsync({ booked_at: new Date().toISOString(), scheduled_at: at, notes: null }).then(
      () => setScheduled(''),
      () => undefined,
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>体験授業</CardTitle>
        <CardDescription>振替で複数回あっても、ファネルでは「体験申込1件」と数えます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {trials.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ体験の申込はありません。</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {trials.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium tabular-nums">{dateTimeText(t.scheduled_at)}</div>
                  <div className="text-xs text-muted-foreground">申込 {dateTimeText(t.booked_at)}</div>
                </div>
                {canEdit ? (
                  <NativeSelect
                    aria-label={`${dateTimeText(t.scheduled_at)} の体験の状態`}
                    className="w-32"
                    value={t.status}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ id: t.id, status: e.target.value as TrialStatus, scheduledAt: t.scheduled_at })}
                  >
                    {(Object.keys(TRIAL_STATUS_LABEL) as TrialStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {TRIAL_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Badge variant="outline">{TRIAL_STATUS_LABEL[t.status]}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        {update.isError && <p role="alert" className="text-sm text-destructive">{update.error.message}</p>}
        {canEdit && (
          <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2" noValidate>
            <Field label="体験の日時（日本時間）" htmlFor="trial-at" error={error ?? add.error?.message} className="min-w-52 flex-1">
              <Input id="trial-at" type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </Field>
            <Button type="submit" disabled={add.isPending}>
              体験を追加
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function EnrollmentCard({ inq, enrollment }: { inq: InquiryPipelineRow; enrollment: EnrollmentRow | null }) {
  const { role } = useOrgContext()
  const isAdmin = hasRole(role, 'admin')
  const courses = useCourses()
  const record = useRecordEnrollment(inq.id)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(inq.child_grade ? String(inq.child_grade) : '')
  const [courseId, setCourseId] = useState('')
  const [date, setDate] = useState(() => toLocalInput(new Date().toISOString()).slice(0, 10))
  const [fee, setFee] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!inq.enrollment_visible) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>入会</CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Lock className="size-3.5" /> 入会・生徒の情報は編集者以上のみ閲覧できます。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }
  if (enrollment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            入会 <StageBadge stage="enrolled" />
          </CardTitle>
          <CardDescription>
            {enrollment.enrolled_on} に入会（月謝 {yen(enrollment.monthly_fee_jpy)}）。1つの問い合わせから入会は1件までです。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim() || name.trim().length > 30) errs.name = '呼び名を30文字以内で入力してください'
    if (!courseId) errs.course = 'コースを選んでください'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.date = '入会日を入力してください'
    const feeNum = fee.trim() ? Number(fee) : null
    if (feeNum !== null && !(Number.isInteger(feeNum) && feeNum >= 0)) errs.fee = '0以上の整数（円）で入力してください'
    setErrors(errs)
    if (Object.keys(errs).length) return
    await record
      .mutateAsync({ displayName: name.trim(), grade: grade ? Number(grade) : null, courseId, enrolledOn: date, monthlyFee: feeNum })
      .catch(() => undefined)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>入会を記録</CardTitle>
        <CardDescription>生徒と契約を同時に作成します。生徒は呼び名と学年だけを保存します（氏名は保存しません）。</CardDescription>
      </CardHeader>
      <CardContent>
        {!isAdmin ? (
          <p className="text-sm text-muted-foreground">入会の記録は管理者以上が行えます。</p>
        ) : courses.data?.length === 0 ? (
          <EmptyState
            title="コースが登録されていません"
            description="入会には月謝のコースが必要です。"
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/marketing?tab=settings">コースを登録</Link>
              </Button>
            }
          />
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label="生徒の呼び名" htmlFor="enr-name" required error={errors.name} hint="例: たろう（氏名は書かない）">
              <Input id="enr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
            </Field>
            <Field label="学年" htmlFor="enr-grade">
              <NativeSelect id="enr-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">不明</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="コース" htmlFor="enr-course" required error={errors.course}>
              <NativeSelect id="enr-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">選択してください</option>
                {courses.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}（{yen(c.monthly_fee_jpy)}）
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="入会日" htmlFor="enr-date" required error={errors.date}>
              <Input id="enr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="月謝（任意）" htmlFor="enr-fee" error={errors.fee} hint="空欄ならコースの月謝">
              <Input id="enr-fee" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
            </Field>
            <div className="flex items-end justify-end sm:col-span-2">
              <Button type="submit" disabled={record.isPending}>
                {record.isPending && <LoaderCircle className="animate-spin" />}
                入会を記録
              </Button>
            </div>
            {record.isError && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {record.error.message}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function LostCard({ inq, canEdit }: { inq: InquiryPipelineRow; canEdit: boolean }) {
  const setLost = useSetLost(inq.id)
  const [reason, setReason] = useState('')
  if (inq.stage === 'enrolled') return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>失注</CardTitle>
        <CardDescription>入会に至らなかったことが確定したら記録します。ファネルでは「検討中」と区別して数えます。</CardDescription>
      </CardHeader>
      <CardContent>
        {inq.closed_lost_at ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {dateTimeText(inq.closed_lost_at)} に失注{inq.closed_lost_reason && `（${inq.closed_lost_reason}）`}
            </span>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setLost.mutate({ lost: false, reason: null })} disabled={setLost.isPending}>
                検討中に戻す
              </Button>
            )}
          </div>
        ) : canEdit ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setLost.mutate({ lost: true, reason: reason.trim() || null })
            }}
          >
            <Field label="理由（任意）" htmlFor="lost-reason" className="min-w-52 flex-1" hint="例: 日程が合わない、費用、他校に決定">
              <Input id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} />
            </Field>
            <Button type="submit" variant="outline" disabled={setLost.isPending}>
              失注にする
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">検討中</p>
        )}
        {setLost.isError && <p role="alert" className="mt-2 text-sm text-destructive">{setLost.error.message}</p>}
      </CardContent>
    </Card>
  )
}

function InquiryDetail({ id }: { id: string }) {
  const q = useInquiry(id)
  const { canEdit, role } = useOrgContext()
  const location = useLocation()
  const contactError = (location.state as { contactError?: string } | null)?.contactError
  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState description={q.error.message} onRetry={() => void q.refetch()} />
  if (!q.data.inquiry) return <EmptyState title="問い合わせが見つかりません" />
  const { inquiry, trials, contact, enrollment } = q.data
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Summary inq={inquiry} />
        {hasRole(role, 'admin') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                連絡先 <Lock className="size-3.5 text-muted-foreground" />
              </CardTitle>
              <CardDescription>管理者以上のみ表示されます。</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              {contactError && <p role="alert" className="mb-2 text-destructive">{contactError}</p>}
              {contact ? (
                <div className="space-y-1">
                  <div>{contact.guardian_name}</div>
                  {contact.email && <div className="text-muted-foreground">{contact.email}</div>}
                  {contact.phone && <div className="text-muted-foreground">{contact.phone}</div>}
                </div>
              ) : (
                <span className="text-muted-foreground">未登録</span>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <div className="space-y-6">
        <TrialsCard inquiryId={inquiry.id} trials={trials} canEdit={canEdit} />
        <EnrollmentCard inq={inquiry} enrollment={enrollment} />
        <LostCard inq={inquiry} canEdit={canEdit} />
      </div>
    </div>
  )
}

export function InquiryDetailPage() {
  const { id } = useParams()
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/marketing">
          <ArrowLeft /> 問い合わせ一覧
        </Link>
      </Button>
      <PageHeader
        title="問い合わせ"
        description="体験・入会・失注をここで記録します。記録した内容がそのまま集客ファネル（経営指標）になります。"
        actions={<DomainBadge domain="business" />}
      />
      <DataGate>{id && <InquiryDetail id={id} />}</DataGate>
    </>
  )
}
