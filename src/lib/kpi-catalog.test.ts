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

  it('すべて経営指標で、実装済み（未実装の指標はカタログに載せない）', () => {
    expect(KPIS.every((k) => k.domain === 'business' && k.status === 'implemented')).toBe(true)
  })

  it('率の指標には分母が書かれている', () => {
    for (const k of KPIS.filter((x) => x.unit === 'percent')) expect(k.denominator).not.toBe('')
  })

  it('「実装済み」の指標は、SQLのビューまたは関数に対応する列が実在する', () => {
    for (const k of KPIS.filter((x) => x.status === 'implemented')) {
      const [view, column] = k.source.split('.')
      expect(
        sql.includes(`create view public.${view}`) || sql.includes(`create or replace function public.${view}(`),
        `${k.id}: view or function ${view}`,
      ).toBe(true)
      expect(sql, `${k.id}: column ${column}`).toMatch(new RegExp(`\\b${column}\\b`))
    }
  })

  it('集客ファネルの指標がそろっている', () => {
    for (const id of ['inquiries', 'trial_booking_rate', 'conversion_inquiry_to_enrollment', 'cpa', 'cac']) {
      expect(getKpi(id).source.startsWith('marketing_funnel.'), id).toBe(true)
    }
  })

  it('値の表示', () => {
    expect(formatKpiValue('percent', 0.0753)).toBe('7.5%')
    expect(formatKpiValue('jpy', 12345.6)).toBe('¥12,346')
    expect(formatKpiValue('percent', null)).toBe('計算不能')
    expect(getKpi('cac').denominator).toBe('新規入会数')
  })
})
