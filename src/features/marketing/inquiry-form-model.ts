import { fromLocalInput } from '@/lib/format'
import type { AttributionMethod, LandingParams } from '@/lib/marketing'
import type { Database } from '@/types/database'

export type InquiryFormValues = {
  inquired_at: string // datetime-local（日本時間）
  landing_url: string
  channel_id: string
  campaign_id: string
  attribution: AttributionMethod
  child_grade: string
  notes: string
  guardian_name: string
  email: string
  phone: string
}

export function initialInquiryValues(nowLocal: string): InquiryFormValues {
  return {
    inquired_at: nowLocal,
    landing_url: '',
    channel_id: '',
    campaign_id: '',
    attribution: 'unknown',
    child_grade: '',
    notes: '',
    guardian_name: '',
    email: '',
    phone: '',
  }
}

type Insert = Omit<Database['public']['Tables']['inquiries']['Insert'], 'organization_id'>
export type ContactInput = { guardian_name: string; email: string | null; phone: string | null }

/**
 * フォーム値 → DBへ送る値。エラーがあれば errors を返す。
 * 追跡リンク（tracked_link）は、流入URLにUTMがある場合だけ選べる。
 */
export function buildInquiry(
  v: InquiryFormValues,
  ctx: { landing: LandingParams | null; includeContact: boolean; now?: Date },
): { ok: true; values: Insert; contact: ContactInput | null } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const inquiredAt = fromLocalInput(v.inquired_at)
  if (!inquiredAt) errors.inquired_at = '問い合わせ日時を入力してください'
  else if (Date.parse(inquiredAt) > (ctx.now ?? new Date()).getTime() + 3600_000) errors.inquired_at = '未来の日時は登録できません'

  if (v.attribution === 'tracked_link' && !ctx.landing) {
    errors.attribution = '「追跡リンク」は、UTM付きの流入URLを反映した場合だけ選べます'
  }
  const grade = v.child_grade ? Number(v.child_grade) : null
  if (grade !== null && !(Number.isInteger(grade) && grade >= 1 && grade <= 9)) errors.child_grade = '学年を選んでください'
  if (v.notes.length > 500) errors.notes = '500文字以内で入力してください'

  let contact: ContactInput | null = null
  if (ctx.includeContact && (v.guardian_name.trim() || v.email.trim() || v.phone.trim())) {
    const email = v.email.trim() || null
    const phone = v.phone.trim() || null
    if (!v.guardian_name.trim()) errors.guardian_name = '連絡先を保存する場合は呼び名が必要です'
    else if (v.guardian_name.trim().length > 50) errors.guardian_name = '50文字以内で入力してください'
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'メールアドレスの形式が正しくありません'
    if (phone && !/^[0-9+\-() ]{6,20}$/.test(phone)) errors.phone = '数字とハイフンで入力してください'
    contact = { guardian_name: v.guardian_name.trim(), email, phone }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    values: {
      inquired_at: inquiredAt!,
      channel_id: v.channel_id || null,
      campaign_id: v.campaign_id || null,
      attribution: v.attribution,
      utm_source: ctx.landing?.utm_source ?? null,
      utm_medium: ctx.landing?.utm_medium ?? null,
      utm_campaign: ctx.landing?.utm_campaign ?? null,
      utm_content: ctx.landing?.utm_content ?? null,
      child_grade: grade,
      notes: v.notes.trim() || null,
    },
    contact,
  }
}
