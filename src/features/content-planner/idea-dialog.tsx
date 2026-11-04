import { LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { DomainBadge } from '@/components/analysis-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogContent } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { usePostKpis, useThemes } from '@/features/social/api'
import { percentText } from '@/features/social/format'
import { FORMAT_LABEL, FORMATS, IDEA_STATUS_LABEL, IDEA_STATUSES, type IdeaStatus, PLATFORM_LABEL, PLATFORMS, type PostFormat, type SocialPlatform } from '@/lib/social'
import type { ContentIdeaRow } from '@/types/database'
import { useSaveIdea } from './api'

const empty = (v: string) => (v.trim() === '' ? null : v.trim())

/** 企画と、その企画から生まれた投稿の実績（仮説と結果の比較） */
function HypothesisVsResult({ idea }: { idea: ContentIdeaRow }) {
  const posts = usePostKpis()
  const linked = posts.data?.filter((p) => p.content_idea_id === idea.id) ?? []
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        仮説と結果 <DomainBadge domain="social" />
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">仮説: </span>
        {idea.hypothesis ?? <span className="text-muted-foreground">未記入</span>}
      </p>
      {linked.length === 0 ? (
        <p className="text-xs text-muted-foreground">この企画に紐づく投稿はまだありません。投稿を登録するときに「元の企画」を選ぶと、ここに結果が表示されます。</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {linked.map((p) => (
            <li key={p.post_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link to={`/social/posts/${p.post_id}`} className="font-medium text-primary hover:underline">
                {p.title}
              </Link>
              {p.snapshot_count === 0 ? (
                <span className="text-muted-foreground">実績未記録（未検証）</span>
              ) : (
                <span className="tabular-nums text-muted-foreground">
                  ER {percentText(p.engagement_rate_reach)} ・ 保存率 {percentText(p.save_rate)} ・ {p.hours_since_publish}h後時点
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function IdeaDialog({ idea, defaultDate, onSaved }: { idea?: ContentIdeaRow; defaultDate?: string; onSaved: () => void }) {
  const themes = useThemes()
  const save = useSaveIdea()
  const [title, setTitle] = useState(idea?.title ?? '')
  const [status, setStatus] = useState<IdeaStatus>(idea?.status ?? 'idea')
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(idea?.platforms ?? [])
  const [themeId, setThemeId] = useState(idea?.theme_id ?? '')
  const [format, setFormat] = useState<string>(idea?.format ?? '')
  const [targetAudience, setTargetAudience] = useState(idea?.target_audience ?? '')
  const [hook, setHook] = useState(idea?.hook ?? '')
  const [cta, setCta] = useState(idea?.cta ?? '')
  const [hypothesis, setHypothesis] = useState(idea?.hypothesis ?? '')
  const [notes, setNotes] = useState(idea?.production_notes ?? '')
  const [productionDate, setProductionDate] = useState(idea?.planned_production_date ?? '')
  const [publishDate, setPublishDate] = useState(idea?.planned_publish_date ?? defaultDate ?? '')
  const [retrospective, setRetrospective] = useState(idea?.retrospective ?? '')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('タイトルを入力してください')
    if (productionDate && publishDate && productionDate > publishDate) return setError('制作予定日が公開予定日より後になっています')
    setError(null)
    try {
      await save.mutateAsync({
        id: idea?.id,
        values: {
          title: title.trim().slice(0, 120),
          status,
          platforms,
          theme_id: themeId || null,
          format: (format || null) as PostFormat | null,
          target_audience: empty(targetAudience),
          hook: empty(hook),
          cta: empty(cta),
          hypothesis: empty(hypothesis),
          production_notes: empty(notes),
          planned_production_date: productionDate || null,
          planned_publish_date: publishDate || null,
          retrospective: empty(retrospective),
        },
      })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <DialogContent title={idea ? '企画を編集' : '企画を追加'} className="max-w-2xl">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="タイトル" htmlFor="idea-title" required className="sm:col-span-2">
            <Input id="idea-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="ステータス" htmlFor="idea-status">
            <NativeSelect id="idea-status" value={status} onChange={(e) => setStatus(e.target.value as IdeaStatus)}>
              {IDEA_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {IDEA_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">投稿先</legend>
            <div className="flex gap-3">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={platforms.includes(p)}
                    onChange={(e) => setPlatforms((cur) => (e.target.checked ? [...cur, p] : cur.filter((x) => x !== p)))}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {PLATFORM_LABEL[p]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="テーマ" htmlFor="idea-theme">
            <NativeSelect id="idea-theme" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              <option value="">未設定</option>
              {themes.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="形式" htmlFor="idea-format">
            <NativeSelect id="idea-format" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">未定</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="制作予定日" htmlFor="idea-prod">
            <Input id="idea-prod" type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
          </Field>
          <Field label="公開予定日" htmlFor="idea-pub">
            <Input id="idea-pub" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
          </Field>
          <Field label="ターゲット層" htmlFor="idea-target">
            <Input id="idea-target" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
          </Field>
          <Field label="CTA" htmlFor="idea-cta">
            <Input id="idea-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
          </Field>
          <Field label="フック" htmlFor="idea-hook" className="sm:col-span-2">
            <Input id="idea-hook" value={hook} onChange={(e) => setHook(e.target.value)} />
          </Field>
          <Field label="仮説" htmlFor="idea-hyp" hint="何が・なぜ反応や問い合わせにつながると考えたか" className="sm:col-span-2">
            <Textarea id="idea-hyp" rows={2} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} />
          </Field>
          <Field label="制作メモ" htmlFor="idea-notes" className="sm:col-span-2">
            <Textarea id="idea-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        {idea && <HypothesisVsResult idea={idea} />}
        {idea && (
          <Field label="投稿後の振り返り" htmlFor="idea-retro" hint="仮説は当たったか、次に何を変えるか">
            <Textarea id="idea-retro" rows={3} value={retrospective} onChange={(e) => setRetrospective(e.target.value)} />
          </Field>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {idea?.ai_generated ? <Badge variant="outline">AI生成の企画</Badge> : <span />}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <LoaderCircle className="animate-spin" />}
            保存する
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
