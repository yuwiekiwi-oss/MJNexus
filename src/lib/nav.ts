import { type LucideIcon, Megaphone, Settings } from 'lucide-react'

/**
 * ナビゲーション定義（サイドバー・パンくずの唯一の情報源）。
 * 必要だと分かった機能だけを追加する方針のため、未実装の機能はメニューに出さない。
 */
export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  module?: string
  description: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'marketing',
    label: 'Marketing',
    path: '/marketing',
    icon: Megaphone,
    module: 'MJ Marketing',
    description: '問い合わせ・体験授業・入会の記録と集客ファネル分析',
  },
]

export const SETTINGS_ITEM: NavItem = {
  id: 'settings',
  label: 'Settings',
  path: '/settings',
  icon: Settings,
  description: 'アカウント・組織・表示・接続状況',
}

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_ITEMS, SETTINGS_ITEM]

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => pathname.startsWith(i.path))
}
