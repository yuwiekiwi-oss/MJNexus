/**
 * Supabase のDB型定義（Phase 1でフロントエンドが使うテーブルのみ）。
 *
 * 本来は `supabase gen types typescript --linked > src/types/database.ts` で
 * スキーマから自動生成する。Supabaseプロジェクト接続後に生成版へ置き換える。
 * 定義元: supabase/migrations/
 */

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type SocialPlatform = 'instagram' | 'tiktok'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; timezone: string; created_at: string; updated_at: string }
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
    }
    Views: { [_ in never]: never }
    Functions: {
      create_organization: { Args: { org_name: string }; Returns: string }
    }
    Enums: {
      member_role: MemberRole
      social_platform: SocialPlatform
    }
    CompositeTypes: { [_ in never]: never }
  }
}
