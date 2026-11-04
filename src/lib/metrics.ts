/**
 * 指標値の表現
 *
 * SNSの指標は「実測0」と「取れていない」を混同すると分析を誤る。
 * 例: TikTokで取得できないリンククリックを0として平均すると、平均が不当に下がる。
 * そこで値を4状態の判別共用体（discriminated union）で表す。
 */

export type MetricStatus = 'measured' | 'not_collected' | 'unsupported'

export type MetricValue =
  | { status: 'measured'; value: number } // 実測（0を含む）
  | { status: 'not_collected' } // 対応しているが未取得
  | { status: 'unsupported' } // プラットフォーム非対応
  | { status: 'not_recorded' } // 記録自体が存在しない

export const METRIC_STATUS_LABEL: Record<MetricValue['status'], string> = {
  measured: '実測',
  not_collected: '未取得',
  unsupported: '非対応',
  not_recorded: '未記録',
}

/** DBの行（status, value）から MetricValue を作る。行が無ければ未記録 */
export function fromRow(row: { status: MetricStatus; value: number | null } | undefined | null): MetricValue {
  if (!row) return { status: 'not_recorded' }
  if (row.status === 'measured') {
    if (row.value === null || !Number.isFinite(row.value) || row.value < 0) {
      throw new Error('measured metric must have a non-negative value')
    }
    return { status: 'measured', value: row.value }
  }
  return { status: row.status }
}

export function formatMetric(m: MetricValue, locale = 'ja-JP'): string {
  return m.status === 'measured' ? m.value.toLocaleString(locale) : METRIC_STATUS_LABEL[m.status]
}

/**
 * 比率（分子 / 分母）。
 * 分子・分母のどちらかが実測でない、または分母が0のときは null（計算不能）を返し、
 * 0% と区別する。
 */
export function safeRate(numerator: MetricValue, denominator: MetricValue): number | null {
  if (numerator.status !== 'measured' || denominator.status !== 'measured') return null
  if (denominator.value === 0) return null
  return numerator.value / denominator.value
}
