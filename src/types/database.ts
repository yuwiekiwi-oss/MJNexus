/**
 * Supabase のDB型定義（フロントエンドが使うテーブル・ビュー・関数）。
 *
 * 本来は `supabase gen types typescript --linked > src/types/database.ts` で
 * スキーマから自動生成する。Supabaseプロジェクト接続後に生成版へ置き換える。
 * 定義元: supabase/migrations/
 */
import type { MetricStatus } from '@/lib/metrics'
import type {
  AttributionMethod,
  ChannelKind,
  FunnelGroup,
  FunnelRow,
  InquiryStage,
  MarketingExpenseCategory,
  TrialStatus,
} from '@/lib/marketing'
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

export type MarketingChannelRow = {
  id: string
  organization_id: string
  code: string
  name: string
  kind: ChannelKind
  platform: SocialPlatform | null
  is_active: boolean
  created_at: string
}
export type CampaignRow = {
  id: string
  organization_id: string
  channel_id: string | null
  name: string
  utm_campaign: string | null
  starts_on: string | null
  ends_on: string | null
  budget_jpy: number | null
  notes: string | null
  created_at: string
  updated_at: string
}
export type InquiryRow = {
  id: string
  organization_id: string
  inquired_at: string
  channel_id: string | null
  campaign_id: string | null
  social_post_id: string | null
  attribution: AttributionMethod
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  child_grade: number | null
  closed_lost_at: string | null
  closed_lost_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
export type InquiryPipelineRow = Omit<InquiryRow, 'created_at' | 'updated_at'> & {
  channel_name: string | null
  campaign_name: string | null
  post_title: string | null
  tracking_code: string | null
  trial_count: number
  attended_count: number
  next_trial_at: string | null
  /** false = 閲覧者（入会情報を読めない） */
  enrollment_visible: boolean
  enrolled_on: string | null
  /** NULL = 権限なし */
  stage: InquiryStage | null
}
export type InquiryContactRow = {
  inquiry_id: string
  organization_id: string
  guardian_name: string
  email: string | null
  phone: string | null
  created_at: string
}
export type TrialLessonRow = {
  id: string
  organization_id: string
  inquiry_id: string
  booked_at: string
  scheduled_at: string
  status: TrialStatus
  attended_at: string | null
  cancelled_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
export type CourseRow = {
  id: string
  organization_id: string
  name: string
  monthly_fee_jpy: number
  is_active: boolean
  created_at: string
}
export type EnrollmentRow = {
  id: string
  organization_id: string
  student_id: string
  course_id: string
  inquiry_id: string | null
  enrolled_on: string
  ended_on: string | null
  status: 'active' | 'paused' | 'ended'
  monthly_fee_jpy: number
  created_at: string
  updated_at: string
}
export type MarketingCostRow = {
  id: string
  organization_id: string
  occurred_on: string
  category: MarketingExpenseCategory
  amount_jpy: number
  channel_id: string | null
  campaign_id: string | null
  vendor: string | null
  description: string | null
}
type ExpenseRow = Omit<MarketingCostRow, 'category'> & {
  category: MarketingExpenseCategory | 'labor' | 'rent' | 'software' | 'equipment' | 'other'
  staff_id: string | null
  created_at: string
  updated_at: string
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
      marketing_channels: Table<MarketingChannelRow, 'organization_id' | 'code' | 'name' | 'kind', 'platform' | 'is_active'>
      campaigns: Table<
        CampaignRow,
        'organization_id' | 'name',
        'channel_id' | 'utm_campaign' | 'starts_on' | 'ends_on' | 'budget_jpy' | 'notes'
      >
      inquiries: Table<
        InquiryRow,
        'organization_id' | 'inquired_at',
        | 'channel_id'
        | 'campaign_id'
        | 'social_post_id'
        | 'attribution'
        | 'utm_source'
        | 'utm_medium'
        | 'utm_campaign'
        | 'utm_content'
        | 'child_grade'
        | 'closed_lost_at'
        | 'closed_lost_reason'
        | 'notes'
      >
      inquiry_contacts: Table<InquiryContactRow, 'inquiry_id' | 'organization_id' | 'guardian_name', 'email' | 'phone'>
      trial_lessons: Table<
        TrialLessonRow,
        'organization_id' | 'inquiry_id' | 'booked_at' | 'scheduled_at',
        'status' | 'attended_at' | 'cancelled_at' | 'notes'
      >
      courses: Table<CourseRow, 'organization_id' | 'name' | 'monthly_fee_jpy', 'is_active'>
      enrollments: {
        Row: EnrollmentRow
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      expense_transactions: Table<
        ExpenseRow,
        'organization_id' | 'occurred_on' | 'category' | 'amount_jpy',
        'channel_id' | 'campaign_id' | 'staff_id' | 'vendor' | 'description'
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
      inquiry_pipeline: { Row: InquiryPipelineRow; Relationships: [] }
      marketing_costs: { Row: MarketingCostRow; Relationships: [] }
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
      record_enrollment: {
        Args: {
          p_inquiry_id: string
          p_display_name: string
          p_grade: number | null
          p_course_id: string
          p_enrolled_on: string
          p_monthly_fee_jpy?: number | null
        }
        Returns: string
      }
      marketing_funnel: {
        Args: { p_org: string; p_from: string; p_to: string; p_group?: FunnelGroup }
        Returns: FunnelRow[]
      }
    }
    Enums: {
      member_role: MemberRole
      social_platform: SocialPlatform
    }
    CompositeTypes: { [_ in never]: never }
  }
}
