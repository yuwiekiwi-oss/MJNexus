import { describe, expect, it } from 'vitest'
import { initialPostValues, postFormSchema } from './post-form-schema'

const valid = { ...initialPostValues(), account_id: 'acc', title: '完成動画', published_at: '2026-11-01T19:00' }

describe('postFormSchema', () => {
  it('日本時間の公開日時をISOに変換し、空欄はnullにする', () => {
    const r = postFormSchema.parse({ ...valid, production_minutes: '45' })
    expect(r.published_at).toBe('2026-11-01T10:00:00.000Z')
    expect(r.production_minutes).toBe(45)
    expect(r.hook).toBeNull()
    expect(r.theme_id).toBeNull()
  })

  it('公開済みなのに公開日時がなければエラー（DBのCHECK制約と同じ）', () => {
    const r = postFormSchema.safeParse({ ...valid, published_at: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['published_at'])
  })

  it('下書きなら公開日時は不要', () => {
    expect(postFormSchema.safeParse({ ...valid, status: 'draft', published_at: '' }).success).toBe(true)
  })

  it('URL・制作時間・追跡コードの形式を検証する', () => {
    for (const bad of [{ post_url: 'http://x' }, { production_minutes: '-1' }, { tracking_code: 'AB' }, { title: ' ' }]) {
      expect(postFormSchema.safeParse({ ...valid, ...bad }).success).toBe(false)
    }
  })
})
