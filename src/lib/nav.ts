import {
  AtSign,
  BookOpen,
  CalendarRange,
  ChartLine,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'

/**
 * ナビゲーション定義（サイドバー・ルーティング・Coming Soon表示の唯一の情報源）
 *
 * status:
 *   available   … 実装済み
 *   coming_soon … 未実装。画面ではComing Soonと明示し、実装済みと誤認させない
 */
export type NavStatus = 'available' | 'coming_soon'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  status: NavStatus
  /** 実装予定フェーズ（docs/architecture.md と対応） */
  phase: number
  module?: string
  description: string
  plannedFeatures: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'ワークスペース',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        path: '/',
        icon: LayoutDashboard,
        status: 'available',
        phase: 1,
        description: 'セットアップ状況と各モジュールの開発状況',
        plannedFeatures: ['主要KPIのサマリー（Phase 2以降でデータに応じて追加）'],
      },
    ],
  },
  {
    label: 'グロース',
    items: [
      {
        id: 'social',
        label: 'Social',
        path: '/social',
        icon: AtSign,
        status: 'available',
        phase: 2,
        module: 'MJ Social',
        description: 'Instagram・TikTokの投稿管理と実績分析',
        plannedFeatures: [
          '投稿の登録（テーマ・形式・フック・CTA・制作時間）',
          '実績の時系列記録（24時間後・72時間後・7日後など）',
          '未記録 / 未取得 / 非対応 / 実測0 の区別',
          'テーマ別・形式別・時間帯別・プラットフォーム別の比較',
          'CSVインポート・エクスポート',
        ],
      },
      {
        id: 'content-planner',
        label: 'Content Planner',
        path: '/content-planner',
        icon: CalendarRange,
        status: 'available',
        phase: 2,
        module: 'MJ Social',
        description: '投稿企画から振り返りまでの制作ワークフロー',
        plannedFeatures: [
          'Idea → Planning → Production → Ready → Published → Analyzed',
          'カンバン表示・カレンダー表示',
          '企画の仮説と投稿実績の比較',
        ],
      },
      {
        id: 'marketing',
        label: 'Marketing',
        path: '/marketing',
        icon: Megaphone,
        status: 'available',
        phase: 3,
        module: 'MJ Marketing',
        description: '問い合わせ・体験授業・入会までの集客ファネル分析',
        plannedFeatures: [
          '問い合わせ・体験申込・体験参加・入会・失注の記録',
          '追跡コード・UTMによる投稿との紐づけ（確度を区別）',
          '問い合わせ月コホートの集客ファネル',
          'チャネル別の成果と獲得単価（CPA・CAC）',
          '問い合わせから入会までの日数',
        ],
      },
    ],
  },
  {
    label: 'インテリジェンス',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        path: '/analytics',
        icon: ChartLine,
        status: 'coming_soon',
        phase: 4,
        module: 'MJ Analytics',
        description: 'SNS・集客・売上・費用を横断した経営分析',
        plannedFeatures: ['SQL集計ビュー', 'Pythonによる統計分析', 'Tableau用データ出力'],
      },
      {
        id: 'ai-insights',
        label: 'AI Insights',
        path: '/ai-insights',
        icon: Sparkles,
        status: 'coming_soon',
        phase: 5,
        module: 'MJ Analytics',
        description: '自然言語で質問できる経営分析AIエージェント',
        plannedFeatures: [
          'Tool Callingによる安全な分析関数の呼び出し',
          '結論・根拠・不確実性を含む構造化回答',
          '回答品質の評価テスト',
        ],
      },
    ],
  },
  {
    label: 'オペレーション',
    items: [
      {
        id: 'finance',
        label: 'Finance',
        path: '/finance',
        icon: Wallet,
        status: 'coming_soon',
        phase: 4,
        module: 'MJ Finance',
        description: '売上・費用・利益の管理',
        plannedFeatures: ['売上・費用の記録', '月次損益と利益率', '広告費管理'],
      },
      {
        id: 'students',
        label: 'Students',
        path: '/students',
        icon: GraduationCap,
        status: 'coming_soon',
        phase: 6,
        module: 'MJ Students',
        description: '生徒・契約管理（個人情報は最小限）',
        plannedFeatures: ['生徒登録', '入会・退会管理', 'コース・月謝管理'],
      },
      {
        id: 'staff',
        label: 'Staff',
        path: '/staff',
        icon: Users,
        status: 'coming_soon',
        phase: 6,
        module: 'MJ Staff',
        description: '講師・稼働管理',
        plannedFeatures: ['講師登録', '授業スケジュール', '稼働時間と人件費'],
      },
      {
        id: 'knowledge',
        label: 'Knowledge',
        path: '/knowledge',
        icon: BookOpen,
        status: 'coming_soon',
        phase: 7,
        module: 'MJ Knowledge',
        description: '教材・運営ナレッジの検索とRAG',
        plannedFeatures: ['教材・マニュアル検索', '出典付きの質問応答'],
      },
      {
        id: 'learning',
        label: 'Learning',
        path: '/learning',
        icon: Gamepad2,
        status: 'coming_soon',
        phase: 7,
        module: 'MJ Learning',
        description: '生徒のゲーム制作プロジェクトと学習進捗',
        plannedFeatures: ['制作・デバッグ・改善履歴', '課題達成状況'],
      },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = {
  id: 'settings',
  label: 'Settings',
  path: '/settings',
  icon: Settings,
  status: 'available',
  phase: 1,
  description: 'アカウント・組織・表示・接続状況',
  plannedFeatures: [],
}

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM]

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => (i.path === '/' ? pathname === '/' : pathname.startsWith(i.path)))
}
