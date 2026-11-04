/**
 * Supabase のDB型定義（フロントエンドが使うテーブル・ビュー・関数）。
 *
 * 本来は `supabase gen types typescript --linked > src/types/database.ts` で
 * スキーマから自動生成する。Supabaseプロジェクト接続後に生成版へ置き換える。
 * 定義元: supabase/migrations/
 */
import type {
  AttributionMethod,
  ChannelKind,
  FunnelGroup,
  FunnelRow,
  InquiryStage,
  MarketingExpenseCategory,
  SocialPlatform,
  TrialStatus,
} from '@/lib/marketing'

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'

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
        'channel_id' | 'campaign_id' | 'vendor' | 'description'
      >
    }
    Views: {
      inquiry_pipeline: { Row: InquiryPipelineRow; Relationships: [] }
      marketing_costs: { Row: MarketingCostRow; Relationships: [] }
    }
    Functions: {
      create_organization: { Args: { org_name: string }; Returns: string }
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
