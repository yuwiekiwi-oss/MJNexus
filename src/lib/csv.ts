/**
 * CSV出力ユーティリティ（RFC 4180 準拠 + 式インジェクション対策）
 *
 * 式インジェクション（CSV Injection）:
 *   セルが = + - @ やタブ・改行で始まると、Excel や Googleスプレッドシートが
 *   「数式」として実行してしまう。悪意ある投稿タイトル等が混ざると外部通信や
 *   情報漏えいにつながるため、先頭に ' を付けて文字列として扱わせる。
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/

export type CsvCell = string | number | boolean | null | undefined | Date

export function sanitizeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') {
    // 数値はそのまま出力（負数の "-" は数式ではない）。NaN/Infinity は空欄
    return Number.isFinite(value) ? String(value) : ''
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  let s = value
  if (FORMULA_PREFIX.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv<T extends Record<string, CsvCell>>(
  rows: readonly T[],
  columns: readonly { key: keyof T & string; header: string }[],
): string {
  const header = columns.map((c) => sanitizeCsvCell(c.header)).join(',')
  const body = rows.map((row) => columns.map((c) => sanitizeCsvCell(row[c.key])).join(','))
  // 先頭のBOMでExcelがUTF-8（日本語）を正しく認識する
  return `﻿${[header, ...body].join('\r\n')}\r\n`
}
