import catalog from '../../shared/kpi-catalog.json'

/**
 * KPIカタログ（shared/kpi-catalog.json）
 * domain:
 *   social   … SNS分析（プラットフォームの集計値）
 *   business … 経営分析（識別できるイベントとお金）
 */
export type KpiDomain = 'social' | 'business'
export type KpiUnit = 'percent' | 'count' | 'jpy' | 'ratio'

export interface KpiDefinition {
  id: string
  version: number
  domain: KpiDomain
  name: string
  formula: string
  denominator: string
  unit: KpiUnit
  source: string
  status: 'implemented' | 'planned'
  note: string
}

export const KPIS = catalog.kpis as KpiDefinition[]

export function getKpi(id: string): KpiDefinition {
  const k = KPIS.find((x) => x.id === id)
  if (!k) throw new Error(`unknown kpi: ${id}`)
  return k
}

export const KPI_DOMAIN_LABEL: Record<KpiDomain, string> = {
  social: 'SNS指標',
  business: '経営指標',
}

export function formatKpiValue(unit: KpiUnit, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '計算不能'
  switch (unit) {
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    case 'jpy':
      return `¥${Math.round(value).toLocaleString('ja-JP')}`
    case 'ratio':
      return `${value.toFixed(2)}倍`
    default:
      return Math.round(value).toLocaleString('ja-JP')
  }
}
