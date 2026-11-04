/**
 * MJ Social のCSVインポート・エクスポート定義
 *
 * 実績CSV（縦に記録時点、横に指標）:
 *   post_url,recorded_at,views,reach,likes,...
 *   値の書き方: 数値=実測 / 空欄=未記録 / 「未取得」/「非対応」
 */
import { type CsvCell, toCsv } from '@/lib/csv'
import { csvToRecords, unescapeFormulaGuard } from '@/lib/csv-parse'
import type { MetricStatus } from '@/lib/metrics'
import {
  FORMAT_LABEL,
  METRIC_IDS,
  METRIC_LABEL,
  type MetricPayload,
  PLATFORM_LABEL,
  POST_STATUS_LABEL,
  type SocialMetric,
} from '@/lib/social'
import type { PostKpiRow } from '@/types/database'

export const METRICS_CSV_REQUIRED = ['post_url', 'recorded_at'] as const
export const METRICS_CSV_OPTIONAL = [...METRIC_IDS, 'note'] as const

const STATUS_WORDS: Record<string, MetricStatus> = {
  未取得: 'not_collected',
  not_collected: 'not_collected',
  非対応: 'unsupported',
  unsupported: 'unsupported',
}

export interface MetricsImportRow {
  line: number
  postUrl: string
  postId: string
  recordedAt: string
  values: MetricPayload[]
  note: string | null
}

export interface ImportError {
  line: number
  message: string
}

export function parseMetricsCsv(
  text: string,
  postsByUrl: ReadonlyMap<string, { id: string; publishedAt: string | null }>,
  now: Date = new Date(),
): { rows: MetricsImportRow[]; errors: ImportError[] } {
  let parsed: ReturnType<typeof csvToRecords>
  try {
    parsed = csvToRecords(text, METRICS_CSV_REQUIRED, METRICS_CSV_OPTIONAL)
  } catch (e) {
    return { rows: [], errors: [{ line: 0, message: (e as Error).message }] }
  }
  if (parsed.headerError) return { rows: [], errors: [{ line: 1, message: parsed.headerError }] }

  const rows: MetricsImportRow[] = []
  const errors: ImportError[] = []
  const seen = new Set<string>()

  parsed.records.forEach((rec, i) => {
    const line = i + 2 // ヘッダーが1行目
    const url = unescapeFormulaGuard(rec.post_url ?? '')
    const post = postsByUrl.get(url)
    if (!post) {
      errors.push({ line, message: `投稿URLが登録されていません: ${url || '(空欄)'}` })
      return
    }
    const recordedAt = new Date(rec.recorded_at ?? '')
    if (Number.isNaN(recordedAt.getTime())) {
      errors.push({ line, message: `recorded_at が日時として読めません: ${rec.recorded_at}（例: 2026-11-05 19:00）` })
      return
    }
    if (recordedAt.getTime() > now.getTime() + 3600_000) {
      errors.push({ line, message: 'recorded_at が未来の日時です' })
      return
    }
    if (post.publishedAt && recordedAt.getTime() < new Date(post.publishedAt).getTime()) {
      errors.push({ line, message: 'recorded_at が投稿の公開日時より前です' })
      return
    }
    const dupKey = `${post.id}|${recordedAt.toISOString()}`
    if (seen.has(dupKey)) {
      errors.push({ line, message: '同じ投稿・同じ記録日時の行が重複しています' })
      return
    }
    seen.add(dupKey)

    const values: MetricPayload[] = []
    let rowError = false
    for (const metric of METRIC_IDS) {
      const raw = (rec[metric] ?? '').replace(/,/g, '').trim()
      if (raw === '') continue
      const status = STATUS_WORDS[raw]
      if (status) {
        values.push({ metric, status, value: null })
      } else if (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))) {
        values.push({ metric, status: 'measured', value: Number(raw) })
      } else {
        errors.push({ line, message: `${METRIC_LABEL[metric as SocialMetric]}（${metric}）の値が不正です: ${raw}` })
        rowError = true
      }
    }
    if (rowError) return
    if (values.length === 0) {
      errors.push({ line, message: '指標の値が1つもありません' })
      return
    }
    rows.push({
      line,
      postUrl: url,
      postId: post.id,
      recordedAt: recordedAt.toISOString(),
      values,
      note: rec.note ? rec.note.slice(0, 500) : null,
    })
  })
  return { rows, errors }
}

/** 実績テンプレート（ヘッダーのみ + 書き方の例は含めない: 例の数値が実データと混ざらないように） */
export function metricsCsvTemplate(): string {
  return toCsv([], [...METRICS_CSV_REQUIRED, ...METRICS_CSV_OPTIONAL].map((k) => ({ key: k, header: k })))
}

/** 数値はそのまま、未取得・非対応は文字で、未記録は空欄で出力する */
export function metricCell(value: number | null, status: string | null): CsvCell {
  if (status === 'measured') return value
  if (status === 'not_collected') return '未取得'
  if (status === 'unsupported') return '非対応'
  return ''
}

export function postsToCsv(rows: readonly PostKpiRow[]): string {
  const data = rows.map((r) => {
    const row: Record<string, CsvCell> = {
      platform: PLATFORM_LABEL[r.platform],
      account: r.account_handle,
      title: r.title,
      theme: r.theme_name ?? '',
      format: FORMAT_LABEL[r.format],
      status: POST_STATUS_LABEL[r.status],
      published_at: r.published_at ?? '',
      recorded_at: r.recorded_at ?? '',
      hours_since_publish: r.hours_since_publish,
      snapshot_count: r.snapshot_count,
      engagement_rate_reach: r.engagement_rate_reach,
      save_rate: r.save_rate,
      profile_visit_rate: r.profile_visit_rate,
    }
    for (const m of METRIC_IDS) row[m] = metricCell(r[m], r[`${m}_status`])
    return row
  })
  const cols = [
    'platform',
    'account',
    'title',
    'theme',
    'format',
    'status',
    'published_at',
    'recorded_at',
    'hours_since_publish',
    'snapshot_count',
    ...METRIC_IDS,
    'engagement_rate_reach',
    'save_rate',
    'profile_visit_rate',
  ]
  return toCsv(data, cols.map((k) => ({ key: k, header: k })))
}

