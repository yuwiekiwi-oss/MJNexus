import { describe, expect, it } from 'vitest'
import { ALL_NAV_ITEMS, findNavItem } from './nav'

describe('navigation', () => {
  it('メニューは Marketing と Settings だけ（未実装の機能は出さない）', () => {
    expect(ALL_NAV_ITEMS.map((i) => i.label)).toEqual(['Marketing', 'Settings'])
  })

  it('パスとIDは重複しない', () => {
    expect(new Set(ALL_NAV_ITEMS.map((i) => i.path)).size).toBe(ALL_NAV_ITEMS.length)
    expect(new Set(ALL_NAV_ITEMS.map((i) => i.id)).size).toBe(ALL_NAV_ITEMS.length)
  })

  it('パスから現在のメニューを特定する', () => {
    expect(findNavItem('/marketing/inquiries/new')?.id).toBe('marketing')
    expect(findNavItem('/settings')?.id).toBe('settings')
    expect(findNavItem('/social')).toBeUndefined()
  })
})
