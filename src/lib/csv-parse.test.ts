import { describe, expect, it } from 'vitest'
import { csvToRecords, parseCsv, unescapeFormulaGuard } from './csv-parse'

describe('parseCsv', () => {
  it('BOM・CRLF・クォート内のカンマ/改行/エスケープを扱う', () => {
    const text = '﻿a,b\r\n"x, y","1行目\n2行目"\r\n"say ""hi""",\r\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', '1行目\n2行目'],
      ['say "hi"', ''],
    ])
  })
  it('閉じられていないクォートはエラー', () => {
    expect(() => parseCsv('a\n"oops')).toThrow('ダブルクォート')
  })
  it('空行は無視する', () => {
    expect(parseCsv('a\n\n1\n')).toEqual([['a'], ['1']])
  })
})

describe('csvToRecords', () => {
  it('必須列の不足・不明な列を検出する', () => {
    expect(csvToRecords('a\n1', ['a', 'b']).headerError).toContain('b')
    expect(csvToRecords('a,zzz\n1,2', ['a']).headerError).toContain('zzz')
  })
  it('前後の空白を除いてオブジェクトにする', () => {
    expect(csvToRecords(' a , b \n 1 , 2 ', ['a'], ['b']).records).toEqual([{ a: '1', b: '2' }])
  })
})

describe('unescapeFormulaGuard', () => {
  it('エクスポート時に付けた先頭の \' を戻す', () => {
    expect(unescapeFormulaGuard("'=1+1")).toBe('=1+1')
    expect(unescapeFormulaGuard("it's")).toBe("it's")
  })
})
