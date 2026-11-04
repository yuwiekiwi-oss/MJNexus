import { CircleDashed, Construction, Inbox, RefreshCw, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface StateProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** データが0件のとき。架空の数値で埋めず、次に何をすればよいかを示す */
export function EmptyState({ title, description, action, className, icon }: StateProps & { icon?: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = '読み込み中…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function ErrorState({
  title = 'エラーが発生しました',
  description,
  onRetry,
  className,
}: Omit<StateProps, 'title'> & { title?: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      <TriangleAlert className="mb-3 size-5 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      {description && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</div>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> 再試行
        </Button>
      )}
    </div>
  )
}

/** 未実装機能の表示。実装済みと誤認されないよう、予定フェーズと予定機能を明記する */
export function ComingSoonState({ phase, features }: { phase: number; features: string[] }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-8">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Construction className="size-4 text-muted-foreground" />
        Coming Soon — Phase {phase} で実装予定
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        この機能はまだ実装されていません。下記は予定している機能で、現時点では利用できません。
      </p>
      {features.length > 0 && (
        <ul className="mt-4 space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CircleDashed className="mt-0.5 size-4 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
