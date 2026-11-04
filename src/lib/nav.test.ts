import { describe, expect, it } from 'vitest'
import { ALL_NAV_ITEMS, findNavItem } from './nav'

describe('navigation', () => {
  it('仕様の主要メニューをすべて含む', () => {
    expect(ALL_NAV_ITEMS.map((i) => i.label)).toEqual([
      'Overview',
      'Social',
      'Content Planner',
      'Marketing',
      'Analytics',
      'AI Insights',
      'Finance',
      'Students',
      'Staff',
      'Knowledge',
      'Learning',
      'Settings',
    ])
  })

  it('Phase 1 で実装済みは Overview と Settings のみ', () => {
    expect(ALL_NAV_ITEMS.filter((i) => i.status === 'available').map((i) => i.id)).toEqual(['overview', 'settings'])
  })

  it('Coming Soon の項目は Phase 2 以降で、予定機能が書かれている', () => {
    for (const item of ALL_NAV_ITEMS.filter((i) => i.status === 'coming_soon')) {
      expect(item.phase).toBeGreaterThanOrEqual(2)
      expect(item.plannedFeatures.length).toBeGreaterThan(0)
    }
  })

  it('パスとIDは重複しない', () => {
    expect(new Set(ALL_NAV_ITEMS.map((i) => i.path)).size).toBe(ALL_NAV_ITEMS.length)
    expect(new Set(ALL_NAV_ITEMS.map((i) => i.id)).size).toBe(ALL_NAV_ITEMS.length)
  })

  it('パスから現在のメニューを特定する', () => {
    expect(findNavItem('/')?.id).toBe('overview')
    expect(findNavItem('/social')?.id).toBe('social')
    expect(findNavItem('/content-planner')?.id).toBe('content-planner')
    expect(findNavItem('/unknown')).toBeUndefined()
  })
})
