import { ArrowLeft, LoaderCircle, Shuffle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DataGate } from '@/components/data-gate'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useIdeas } from '@/features/content-planner/api'
import { useOrgContext } from '@/features/organization/use-org-context'
import { FORMAT_LABEL, FORMATS, generateTrackingCode, PLATFORM_LABEL, POST_STATUS_LABEL, POST_STATUSES } from '@/lib/social'
import type { SocialPostRow } from '@/types/database'
import { useAccounts, usePost, useSavePost, useThemes } from './api'
import { initialPostValues, type PostFormValues, postFormSchema } from './post-form-schema'

function PostForm({ post }: { post?: SocialPostRow | null }) {
  const navigate = useNavigate()
  const { canEdit } = useOrgContext()
  const accounts = useAccounts()
  const themes = useThemes()
  const ideas = useIdeas()
  const save = useSavePost()
  const [values, setValues] = useState<PostFormValues>(() => initialPostValues(post))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: keyof PostFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }))

  if (accounts.isPending) return <LoadingState />
  if (accounts.isError) return <ErrorState description={accounts.error.message} onRetry={() => void accounts.refetch()} />
  if (accounts.data.length === 0) {
    return (
      <EmptyState
        title="先にSNSアカウントを登録してください"
        description="投稿はアカウントに紐づけて記録します。"
        action={
          <Button asChild size="sm">
            <Link to="/social?tab=accounts">アカウントを登録</Link>
          </Button>
        }
      />
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = postFormSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    setErrors({})
    const id = await save.mutateAsync({ id: post?.id, values: parsed.data }).catch(() => null)
    if (id) navigate(`/social/posts/${id}`)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="アカウント" htmlFor="account_id" required error={errors.account_id}>
            <NativeSelect id="account_id" value={values.account_id} onChange={set('account_id')}>
              <option value="">選択してください</option>
              {accounts.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {PLATFORM_LABEL[a.platform]} @{a.handle}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="ステータス" htmlFor="status" error={errors.status}>
            <NativeSelect id="status" value={values.status} onChange={set('status')}>
              {POST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {POST_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="タイトル" htmlFor="title" required error={errors.title} className="sm:col-span-2">
            <Input id="title" value={values.title} onChange={set('title')} maxLength={120} placeholder="例: 小5が作った脱出ゲーム完成動画" />
          </Field>
          <Field label="公開日時（日本時間）" htmlFor="published_at" error={errors.published_at}>
            <Input id="published_at" type="datetime-local" value={values.published_at} onChange={set('published_at')} />
          </Field>
          <Field label="投稿URL" htmlFor="post_url" error={errors.post_url} hint="CSVで実績を取り込むときの照合キーになります">
            <Input id="post_url" type="url" value={values.post_url} onChange={set('post_url')} placeholder="https://" />
          </Field>
          <Field label="テーマ" htmlFor="theme_id">
            <NativeSelect id="theme_id" value={values.theme_id} onChange={set('theme_id')}>
              <option value="">未設定</option>
              {themes.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="形式" htmlFor="format">
            <NativeSelect id="format" value={values.format} onChange={set('format')}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="冒頭のフック" htmlFor="hook" error={errors.hook} className="sm:col-span-2">
            <Input id="hook" value={values.hook} onChange={set('hook')} placeholder="最初の1〜2秒で見せる言葉・映像" />
          </Field>
          <Field label="ターゲット層" htmlFor="target_audience" error={errors.target_audience}>
            <Input id="target_audience" value={values.target_audience} onChange={set('target_audience')} placeholder="例: 小学生の保護者" />
          </Field>
          <Field label="CTA" htmlFor="cta" error={errors.cta} hint="見た人にしてほしい行動">
            <Input id="cta" value={values.cta} onChange={set('cta')} placeholder="例: プロフィールから体験授業へ" />
          </Field>
          <Field label="投稿内容・説明文" htmlFor="caption" error={errors.caption} className="sm:col-span-2">
            <Textarea id="caption" value={values.caption} onChange={set('caption')} rows={3} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="制作時間（分）" htmlFor="production_minutes" error={errors.production_minutes} hint="制作効率の計算に使います">
            <Input id="production_minutes" inputMode="numeric" value={values.production_minutes} onChange={set('production_minutes')} />
          </Field>
          <Field label="元の企画" htmlFor="content_idea_id" hint="仮説と結果を比較できます">
            <NativeSelect id="content_idea_id" value={values.content_idea_id} onChange={set('content_idea_id')}>
              <option value="">なし</option>
              {ideas.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="追跡コード"
            htmlFor="tracking_code"
            error={errors.tracking_code}
            hint="リンクのutm_contentに付け、問い合わせと投稿をつなぎます"
          >
            <div className="flex gap-2">
              <Input id="tracking_code" value={values.tracking_code} onChange={set('tracking_code')} className="font-mono" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="追跡コードを生成"
                onClick={() => setValues((v) => ({ ...v, tracking_code: generateTrackingCode() }))}
              >
                <Shuffle />
              </Button>
            </div>
          </Field>
        </CardContent>
      </Card>

      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {save.error.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          キャンセル
        </Button>
        <Button type="submit" disabled={save.isPending || !canEdit}>
          {save.isPending && <LoaderCircle className="animate-spin" />}
          {post ? '保存する' : '登録する'}
        </Button>
      </div>
      {!canEdit && <p className="text-right text-xs text-muted-foreground">閲覧者は投稿を編集できません。</p>}
    </form>
  )
}

export function PostFormPage() {
  const { id } = useParams()
  const post = usePost(id)
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to={id ? `/social/posts/${id}` : '/social'}>
          <ArrowLeft /> 戻る
        </Link>
      </Button>
      <PageHeader title={id ? '投稿を編集' : '投稿を登録'} description="インサイトを見ながら短時間で記録できるよう、必須はアカウントとタイトルだけです。" />
      <DataGate>
        {id ? (
          post.isPending ? (
            <LoadingState />
          ) : post.isError ? (
            <ErrorState description={post.error.message} onRetry={() => void post.refetch()} />
          ) : !post.data ? (
            <EmptyState title="投稿が見つかりません" />
          ) : (
            <PostForm post={post.data} />
          )
        ) : (
          <PostForm />
        )}
      </DataGate>
    </>
  )
}
