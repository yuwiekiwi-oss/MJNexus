import { CalendarRange, ChevronLeft, ChevronRight, Columns3, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DataGate } from '@/components/data-gate'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useOrgContext } from '@/features/organization/use-org-context'
import { usePostKpis } from '@/features/social/api'
import {
  IDEA_STATUS_HINT,
  IDEA_STATUS_LABEL,
  IDEA_STATUSES,
  nextIdeaStatus,
  PLATFORM_LABEL,
  prevIdeaStatus,
} from '@/lib/social'
import { cn } from '@/lib/utils'
import type { ContentIdeaRow } from '@/types/database'
import { useIdeas, useMoveIdea } from './api'
import { jstDateKey, monthGrid, toDateKey } from './calendar'
import { IdeaDialog } from './idea-dialog'

type View = 'kanban' | 'calendar'

function IdeaCard({ idea, onOpen }: { idea: ContentIdeaRow; onOpen: () => void }) {
  const { canEdit } = useOrgContext()
  const move = useMoveIdea()
  const prev = prevIdeaStatus(idea.status)
  const next = nextIdeaStatus(idea.status)
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xs">
      <button type="button" onClick={onOpen} className="block w-full text-left text-sm font-medium hover:underline">
        {idea.title}
      </button>
      <div className="mt-2 flex flex-wrap gap-1">
        {idea.platforms.map((p) => (
          <Badge key={p} variant="outline">
            {PLATFORM_LABEL[p]}
          </Badge>
        ))}
        {idea.planned_publish_date && <Badge variant="secondary">公開 {idea.planned_publish_date.slice(5).replace('-', '/')}</Badge>}
        {idea.hypothesis && <Badge variant="outline">仮説あり</Badge>}
      </div>
      {canEdit && (
        <div className="mt-2 flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!prev || move.isPending}
            aria-label={prev ? `${IDEA_STATUS_LABEL[prev]}に戻す` : '前のステータスはありません'}
            onClick={() => prev && move.mutate({ id: idea.id, status: prev })}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!next || move.isPending}
            aria-label={next ? `${IDEA_STATUS_LABEL[next]}へ進める` : '最後のステータスです'}
            onClick={() => next && move.mutate({ id: idea.id, status: next })}
          >
            {next && IDEA_STATUS_LABEL[next]} <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}

function Kanban({ ideas, onOpen }: { ideas: ContentIdeaRow[]; onOpen: (i: ContentIdeaRow) => void }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[1080px] grid-cols-6 gap-3">
        {IDEA_STATUSES.map((s) => {
          const items = ideas.filter((i) => i.status === s)
          return (
            <section key={s} aria-label={IDEA_STATUS_LABEL[s]} className="flex min-w-0 flex-col gap-2 rounded-xl bg-muted/40 p-2">
              <header className="flex items-baseline justify-between px-1">
                <div>
                  <span className="text-sm font-medium">{IDEA_STATUS_LABEL[s]}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{IDEA_STATUS_HINT[s]}</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
              </header>
              {items.map((i) => (
                <IdeaCard key={i.id} idea={i} onOpen={() => onOpen(i)} />
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Calendar({ ideas, onOpen, onCreate }: { ideas: ContentIdeaRow[]; onOpen: (i: ContentIdeaRow) => void; onCreate: (date: string) => void }) {
  const { canEdit } = useOrgContext()
  const posts = usePostKpis()
  const [today] = useState(() => new Date())
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const grid = monthGrid(cursor.y, cursor.m)
  const todayKey = toDateKey(today)
  const shift = (d: number) => setCursor(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="前の月" onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <div className="min-w-28 text-center text-sm font-medium tabular-nums">
          {cursor.y}年{cursor.m + 1}月
        </div>
        <Button variant="outline" size="icon" aria-label="次の月" onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary" /> 企画（公開予定）
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-success" /> 公開済み投稿
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 overflow-hidden rounded-xl border">
          {['月', '火', '水', '木', '金', '土', '日'].map((d) => (
            <div key={d} className="border-b bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
              {d}
            </div>
          ))}
          {grid.map((cell) => {
            const dayIdeas = ideas.filter((i) => i.planned_publish_date === cell.key)
            const dayPosts = posts.data?.filter((p) => p.published_at && jstDateKey(p.published_at) === cell.key) ?? []
            return (
              <div
                key={cell.key}
                className={cn('min-h-24 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0', !cell.inMonth && 'bg-muted/20 text-muted-foreground/60')}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs tabular-nums', cell.key === todayKey && 'rounded bg-primary px-1 font-semibold text-primary-foreground')}>
                    {cell.day}
                  </span>
                  {canEdit && cell.inMonth && (
                    <button
                      type="button"
                      aria-label={`${cell.key}に企画を追加`}
                      onClick={() => onCreate(cell.key)}
                      className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 [div:hover>div>&]:opacity-100"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {dayIdeas.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onOpen(i)}
                      className="block w-full truncate rounded bg-accent px-1.5 py-0.5 text-left text-[11px] text-accent-foreground hover:bg-accent/70"
                    >
                      {i.title}
                    </button>
                  ))}
                  {dayPosts.map((p) => (
                    <Link
                      key={p.post_id}
                      to={`/social/posts/${p.post_id}`}
                      className="block truncate rounded bg-success/15 px-1.5 py-0.5 text-[11px] text-success hover:bg-success/25"
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Planner() {
  const ideas = useIdeas()
  const { canEdit } = useOrgContext()
  const [view, setView] = useState<View>('kanban')
  const [dialog, setDialog] = useState<{ idea?: ContentIdeaRow; date?: string } | null>(null)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="表示切り替え" className="inline-flex rounded-lg border p-1">
          {(
            [
              ['kanban', 'カンバン', Columns3],
              ['calendar', 'カレンダー', CalendarRange],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                view === v ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setDialog({})}>
            <Plus /> 企画を追加
          </Button>
        )}
      </div>

      {ideas.isPending ? (
        <LoadingState />
      ) : ideas.isError ? (
        <ErrorState description={ideas.error.message} onRetry={() => void ideas.refetch()} />
      ) : ideas.data.length === 0 && view === 'kanban' ? (
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title="まだ企画がありません"
          description="投稿のアイデアを登録し、Idea → Planning → Production → Ready → Published → Analyzed の順に進めます。"
          action={
            canEdit && (
              <Button size="sm" onClick={() => setDialog({})}>
                <Plus /> 最初の企画を追加
              </Button>
            )
          }
        />
      ) : view === 'kanban' ? (
        <Kanban ideas={ideas.data} onOpen={(i) => setDialog({ idea: i })} />
      ) : (
        <Calendar ideas={ideas.data} onOpen={(i) => setDialog({ idea: i })} onCreate={(date) => setDialog({ date })} />
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && <IdeaDialog key={dialog.idea?.id ?? `new-${dialog.date ?? ''}`} idea={dialog.idea} defaultDate={dialog.date} onSaved={() => setDialog(null)} />}
      </Dialog>
    </>
  )
}

export function ContentPlannerPage() {
  return (
    <>
      <PageHeader title="Content Planner" description="投稿の企画から公開、振り返りまでを管理し、企画時の仮説と実績を比べます。" />
      <DataGate>
        <Planner />
      </DataGate>
    </>
  )
}
