/**
 * Supabase のDB型定義（フロントエンドが使うテーブル・ビュー・関数）。
 *
 * 本来は `supabase gen types typescript --linked > src/types/database.ts` で
 * スキーマから自動生成する。Supabaseプロジェクト接続後に生成版へ置き換える。
 * 定義元: supabase/migrations/
 */
import type { MetricStatus } from '@/lib/metrics'
import type { IdeaStatus, PostFormat, PostStatus, SocialMetric, SocialPlatform } from '@/lib/social'

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type { IdeaStatus, PostFormat, PostStatus, SocialMetric, SocialPlatform }
export type DataSource = 'manual' | 'csv_import' | 'api'

type Table<Row, Required extends keyof Row, Optional extends keyof Row = never> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Pick<Row, Optional>>
  Update: Partial<Pick<Row, Required | Optional>>
  Relationships: []
}

export type OrganizationRow = {
  id: string
  name: string
  timezone: string
  created_at: string
  updated_at: string
}
export type SocialAccountRow = {
  id: string
  organization_id: string
  platform: SocialPlatform
  handle: string
  display_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
export type ContentThemeRow = {
  id: string
  organization_id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}
export type ContentIdeaRow = {
  id: string
  organization_id: string
  title: string
  status: IdeaStatus
  platforms: SocialPlatform[]
  theme_id: string | null
  format: PostFormat | null
  target_audience: string | null
  hook: string | null
  cta: string | null
  hypothesis: string | null
  production_notes: string | null
  planned_production_date: string | null
  planned_publish_date: string | null
  retrospective: string | null
  ai_generated: boolean
  initiative_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
export type SocialPostRow = {
  id: string
  organization_id: string
  account_id: string
  content_idea_id: string | null
  theme_id: string | null
  post_url: string | null
  title: string
  format: PostFormat
  caption: string | null
  hook: string | null
  target_audience: string | null
  cta: string | null
  status: PostStatus
  published_at: string | null
  production_minutes: number | null
  tracking_code: string | null
  created_at: string
  updated_at: string
}

type MetricColumns = {
  [K in SocialMetric]: number | null
} & {
  [K in SocialMetric as `${K}_status`]: MetricStatus | null
}

export type SnapshotKpiRow = MetricColumns & {
  organization_id: string
  post_id: string
  snapshot_id: string
  recorded_at: string
  source: DataSource
  hours_since_publish: number | null
  engagements: number | null
  engagement_rate_reach: number | null
  engagement_rate_views: number | null
  save_rate: number | null
  share_rate: number | null
  profile_visit_rate: number | null
  link_click_rate: number | null
  reach_per_production_hour: number | null
}

export type PostKpiRow = MetricColumns & {
  post_id: string
  organization_id: string
  account_id: string
  platform: SocialPlatform
  account_handle: string
  title: string
  theme_id: string | null
  theme_name: string | null
  format: PostFormat
  cta: string | null
  status: PostStatus
  published_at: string | null
  published_hour_jst: number | null
  published_dow_jst: number | null
  production_minutes: number | null
  content_idea_id: string | null
  tracking_code: string | null
  snapshot_count: number
  snapshot_id: string | null
  recorded_at: string | null
  hours_since_publish: number | null
  engagements: number | null
  engagement_rate_reach: number | null
  engagement_rate_views: number | null
  save_rate: number | null
  share_rate: number | null
  profile_visit_rate: number | null
  link_click_rate: number | null
  reach_per_production_hour: number | null
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow
        Insert: { id?: string; name: string; timezone?: string }
        Update: { name?: string; timezone?: string }
        Relationships: []
      }
      organization_members: {
        Row: { organization_id: string; user_id: string; role: MemberRole; created_at: string }
        Insert: { organization_id: string; user_id: string; role?: MemberRole }
        Update: { role?: MemberRole }
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string; updated_at: string }
        Insert: { id: string; display_name?: string | null }
        Update: { display_name?: string | null }
        Relationships: []
      }
      social_accounts: Table<SocialAccountRow, 'organization_id' | 'platform' | 'handle', 'display_name' | 'is_active'>
      content_themes: Table<ContentThemeRow, 'organization_id' | 'name', 'description' | 'sort_order' | 'is_active'>
      content_ideas: Table<
        ContentIdeaRow,
        'organization_id' | 'title',
        | 'status'
        | 'platforms'
        | 'theme_id'
        | 'format'
        | 'target_audience'
        | 'hook'
        | 'cta'
        | 'hypothesis'
        | 'production_notes'
        | 'planned_production_date'
        | 'planned_publish_date'
        | 'retrospective'
      >
      social_posts: Table<
        SocialPostRow,
        'organization_id' | 'account_id' | 'title' | 'format',
        | 'content_idea_id'
        | 'theme_id'
        | 'post_url'
        | 'caption'
        | 'hook'
        | 'target_audience'
        | 'cta'
        | 'status'
        | 'published_at'
        | 'production_minutes'
        | 'tracking_code'
      >
      social_post_metrics: {
        Row: { id: string; organization_id: string; post_id: string; recorded_at: string; source: DataSource; note: string | null }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      social_post_kpis: { Row: PostKpiRow; Relationships: [] }
      social_post_snapshot_kpis: { Row: SnapshotKpiRow; Relationships: [] }
    }
    Functions: {
      create_organization: { Args: { org_name: string }; Returns: string }
      record_post_metrics: {
        Args: {
          p_post_id: string
          p_recorded_at: string
          p_values: { metric: SocialMetric; status: MetricStatus; value: number | null }[]
          p_source?: DataSource
          p_note?: string | null
        }
        Returns: string
      }
    }
    Enums: {
      member_role: MemberRole
      social_platform: SocialPlatform
    }
    CompositeTypes: { [_ in never]: never }
  }
}
