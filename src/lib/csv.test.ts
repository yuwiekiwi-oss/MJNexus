import { describe, expect, it } from 'vitest'
import { sanitizeCsvCell, toCsv } from './csv'

describe('sanitizeCsvCell', () => {
  it.each(['=HYPERLINK("http://evil")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    '数式として解釈される先頭文字を無害化する: %s',
    (input) => {
      expect(sanitizeCsvCell(input).replace(/^"/, '').startsWith("'")).toBe(true)
    },
  )

  it('カンマ・改行・ダブルクォートをエスケープする', () => {
    expect(sanitizeCsvCell('a,b')).toBe('"a,b"')
    expect(sanitizeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(sanitizeCsvCell('1行目\n2行目')).toBe('"1行目\n2行目"')
  })

  it('数値はそのまま、負数も数値として出力する', () => {
    expect(sanitizeCsvCell(0)).toBe('0')
    expect(sanitizeCsvCell(-1200)).toBe('-1200')
    expect(sanitizeCsvCell(Number.NaN)).toBe('')
  })

  it('null / undefined は空欄（0ではない）', () => {
    expect(sanitizeCsvCell(null)).toBe('')
    expect(sanitizeCsvCell(undefined)).toBe('')
  })
})

describe('toCsv', () => {
  it('BOM付き・CRLF区切りで出力する', () => {
    const csv = toCsv([{ title: '=1+1', views: 10 }], [
      { key: 'title', header: 'タイトル' },
      { key: 'views', header: '再生数' },
    ])
    expect(csv).toBe("﻿タイトル,再生数\r\n'=1+1,10\r\n")
  })
})
