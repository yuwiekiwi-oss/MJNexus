import { describe, expect, it } from 'vitest'
import { looksLikeSecretKey, parseSupabaseEnv } from './env'

function fakeJwt(payload: object): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`
}

describe('parseSupabaseEnv', () => {
  it('未設定なら missing（未接続として扱う）', () => {
    expect(parseSupabaseEnv({})).toEqual({ status: 'missing' })
    expect(parseSupabaseEnv({ url: '  ', anonKey: '' })).toEqual({ status: 'missing' })
  })

  it('片方だけの設定は invalid', () => {
    expect(parseSupabaseEnv({ url: 'https://x.supabase.co' }).status).toBe('invalid')
  })

  it('URL形式でなければ invalid', () => {
    expect(parseSupabaseEnv({ url: 'not a url', anonKey: 'sb_publishable_abc' }).status).toBe('invalid')
  })

  it('anon / publishable キーは configured', () => {
    expect(parseSupabaseEnv({ url: 'https://x.supabase.co', anonKey: 'sb_publishable_abc' })).toEqual({
      status: 'configured',
      url: 'https://x.supabase.co',
      anonKey: 'sb_publishable_abc',
    })
    expect(parseSupabaseEnv({ url: 'https://x.supabase.co', anonKey: fakeJwt({ role: 'anon' }) }).status).toBe(
      'configured',
    )
  })

  it('service_role / secret キーはフロントエンドで拒否する', () => {
    for (const key of [fakeJwt({ role: 'service_role' }), 'sb_secret_xxx', 'sk-proj-xxx']) {
      const env = parseSupabaseEnv({ url: 'https://x.supabase.co', anonKey: key })
      expect(env.status).toBe('invalid')
      expect(looksLikeSecretKey(key)).toBe(true)
    }
  })
})
