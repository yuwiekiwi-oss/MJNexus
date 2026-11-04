import { z } from 'zod'
import { FORMATS, POST_STATUSES, type PostFormat, type PostStatus } from '@/lib/social'
import type { SocialPostRow } from '@/types/database'
import { fromLocalInput, toLocalInput } from './format'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max}文字以内で入力してください` })
    .transform((v) => (v === '' ? null : v))

/** 投稿フォームの検証ルール（DBのCHECK制約と同じ条件をフロントでも確認） */
export const postFormSchema = z
  .object({
    account_id: z.string().min(1, { error: 'アカウントを選択してください' }),
    title: z.string().trim().min(1, { error: 'タイトルを入力してください' }).max(120, { error: '120文字以内' }),
    theme_id: z.string().transform((v) => (v === '' ? null : v)),
    format: z.enum(FORMATS as [PostFormat, ...PostFormat[]]),
    status: z.enum(POST_STATUSES as [PostStatus, ...PostStatus[]]),
    published_at: z.string(),
    post_url: z
      .string()
      .trim()
      .refine((v) => v === '' || /^https:\/\/\S+$/.test(v), { error: 'https:// で始まるURLを入力してください' })
      .transform((v) => (v === '' ? null : v)),
    hook: optionalText(200),
    caption: optionalText(5000),
    target_audience: optionalText(100),
    cta: optionalText(100),
    production_minutes: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 10000), { error: '0〜10000の整数（分）' })
      .transform((v) => (v === '' ? null : Number(v))),
    content_idea_id: z.string().transform((v) => (v === '' ? null : v)),
    tracking_code: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[a-z0-9]{4,16}$/.test(v), { error: '英小文字・数字 4〜16文字' })
      .transform((v) => (v === '' ? null : v)),
  })
  .transform((v, ctx) => {
    const published = fromLocalInput(v.published_at)
    if (v.status === 'published' && !published) {
      ctx.addIssue({ code: 'custom', path: ['published_at'], message: '公開済みの投稿は公開日時が必要です' })
      return z.NEVER
    }
    return { ...v, published_at: published }
  })

export type PostFormValues = z.input<typeof postFormSchema>

export function initialPostValues(post?: SocialPostRow | null): PostFormValues {
  return {
    account_id: post?.account_id ?? '',
    title: post?.title ?? '',
    theme_id: post?.theme_id ?? '',
    format: post?.format ?? 'reel',
    status: post?.status ?? 'published',
    published_at: toLocalInput(post?.published_at),
    post_url: post?.post_url ?? '',
    hook: post?.hook ?? '',
    caption: post?.caption ?? '',
    target_audience: post?.target_audience ?? '',
    cta: post?.cta ?? '',
    production_minutes: post?.production_minutes?.toString() ?? '',
    content_idea_id: post?.content_idea_id ?? '',
    tracking_code: post?.tracking_code ?? '',
  }
}

