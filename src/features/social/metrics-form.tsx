import { LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { MetricStatus } from '@/lib/metrics'
import {
  METRICS,
  type MetricInput,
  presetRecordedAt,
  SNAPSHOT_PRESETS,
  type SocialMetric,
  toMetricPayload,
} from '@/lib/social'
import { cn } from '@/lib/utils'
import { useRecordMetrics } from './api'
import { fromLocalInput, toLocalInput } from './format'

const STATUS_OPTIONS: { value: MetricStatus; label: string }[] = [
  { value: 'measured', label: '値' },
  { value: 'not_collected', label: '未取得' },
  { value: 'unsupported', label: '非対応' },
]

/**
 * 実績の記録フォーム。
 * 空欄は「未記録」として保存しない。取れない指標は「未取得」「非対応」を選ぶ（0を入れない）。
 */
export function MetricsForm({ postId, publishedAt, onDone }: { postId: string; publishedAt: string | null; onDone?: () => void }) {
  const record = useRecordMetrics()
  const [recordedAt, setRecordedAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [inputs, setInputs] = useState<Partial<Record<SocialMetric, MetricInput>>>({})
  const [errors, setErrors] = useState<Partial<Record<SocialMetric, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const update = (metric: SocialMetric, patch: Partial<MetricInput>) =>
    setInputs((prev) => ({ ...prev, [metric]: { status: 'measured', value: '', ...prev[metric], ...patch } }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const at = fromLocalInput(recordedAt)
    if (!at) return setFormError('記録日時を入力してください')
    if (new Date(at).getTime() > Date.now() + 3600_000) return setFormError('記録日時が未来になっています')
    if (publishedAt && new Date(at) < new Date(publishedAt)) return setFormError('記録日時が公開日時より前です')
    const { payload, errors: errs } = toMetricPayload(inputs)
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (payload.length === 0) return setFormError('指標を1つ以上入力してください（空欄は未記録として扱います）')
    try {
      await record.mutateAsync({ postId, recordedAt: at, values: payload })
      setInputs({})
      onDone?.()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="記録日時（インサイトを見た時刻）" htmlFor="recorded_at" className="w-64">
          <Input id="recorded_at" type="datetime-local" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
        </Field>
        {publishedAt && (
          <div className="flex flex-wrap gap-1.5" aria-label="公開からの経過時間で記録日時を設定">
            {SNAPSHOT_PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRecordedAt(toLocalInput(presetRecordedAt(publishedAt, p.hours).toISOString()))}
              >
                {p.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((m) => {
          const input = inputs[m.id] ?? { status: 'measured' as MetricStatus, value: '' }
          return (
            <div key={m.id} className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`metric-${m.id}`} className="text-sm font-medium">
                {m.label}
              </label>
              <div className="flex gap-1.5">
                <Input
                  id={`metric-${m.id}`}
                  inputMode="numeric"
                  value={input.status === 'measured' ? input.value : ''}
                  disabled={input.status !== 'measured'}
                  placeholder={input.status === 'measured' ? '空欄=未記録' : STATUS_OPTIONS.find((o) => o.value === input.status)?.label}
                  aria-invalid={Boolean(errors[m.id])}
                  onChange={(e) => update(m.id, { value: e.target.value })}
                  className="tabular-nums"
                />
                <div role="radiogroup" aria-label={`${m.label}の状態`} className="flex shrink-0 rounded-md border p-0.5">
                  {STATUS_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={input.status === o.value}
                      onClick={() => update(m.id, { status: o.value })}
                      className={cn(
                        'rounded px-1.5 text-xs transition-colors',
                        input.status === o.value ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {errors[m.id] && (
                <p className="text-xs text-destructive" role="alert">
                  {errors[m.id]}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={record.isPending}>
          {record.isPending && <LoaderCircle className="animate-spin" />}
          実績を記録
        </Button>
      </div>
    </form>
  )
}
