import { describe, expect, it } from 'vitest'
import { formatKpiValue, getKpi, KPIS } from './kpi-catalog'

// マイグレーションSQLを文字列として読み込む（Viteの import.meta.glob）
const sql = Object.values(
  import.meta.glob<string>('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }),
).join('\n')

describe('KPIカタログ', () => {
  it('id は一意で、版は1以上', () => {
    expect(new Set(KPIS.map((k) => k.id)).size).toBe(KPIS.length)
    for (const k of KPIS) expect(k.version).toBeGreaterThanOrEqual(1)
  })

  it('SNS指標と経営指標を区別している', () => {
    expect(KPIS.some((k) => k.domain === 'social')).toBe(true)
    expect(KPIS.some((k) => k.domain === 'business')).toBe(true)
  })

  it('率の指標には分母が書かれている', () => {
    for (const k of KPIS.filter((x) => x.unit === 'percent')) expect(k.denominator).not.toBe('')
  })

  it('「実装済み」のSNS指標は、SQLビューに対応する列が実在する', () => {
    for (const k of KPIS.filter((x) => x.status === 'implemented')) {
      const [view, column] = k.source.split('.')
      expect(sql, `${k.id}: view ${view}`).toContain(`create view public.${view}`)
      expect(sql, `${k.id}: column ${column}`).toMatch(new RegExp(`\\b${column}\\b`))
    }
  })

  it('経営指標は Phase 2 時点ではまだ実装されていない（未検証）', () => {
    expect(KPIS.filter((k) => k.domain === 'business').every((k) => k.status === 'planned')).toBe(true)
  })

  it('値の表示', () => {
    expect(formatKpiValue('percent', 0.0753)).toBe('7.5%')
    expect(formatKpiValue('jpy', 12345.6)).toBe('¥12,346')
    expect(formatKpiValue('percent', null)).toBe('計算不能')
    expect(getKpi('save_rate').denominator).toBe('リーチ数')
  })
})
