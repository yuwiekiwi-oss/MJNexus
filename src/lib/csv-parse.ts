/**
 * CSVの読み込み（RFC 4180: ダブルクォート・改行を含むセルに対応）
 * 入力は信頼できないデータとして扱い、行数・サイズに上限を設ける。
 */

export const CSV_MAX_BYTES = 2 * 1024 * 1024
export const CSV_MAX_ROWS = 5000

export function parseCsv(text: string): string[][] {
  if (text.length > CSV_MAX_BYTES) throw new Error('ファイルが大きすぎます（上限2MB）')
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += c
      continue
    }
    if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (rows.length > CSV_MAX_ROWS + 1) throw new Error(`行数が多すぎます（上限${CSV_MAX_ROWS}行）`)
    } else cell += c
  }
  if (inQuotes) throw new Error('ダブルクォートが閉じられていません')
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0]?.trim() === ''))
}

/** 先頭行をヘッダーとしてオブジェクト配列にする。不足・余分な列はエラー */
export function csvToRecords(
  text: string,
  requiredHeaders: readonly string[],
  optionalHeaders: readonly string[] = [],
): { records: Record<string, string>[]; headerError: string | null } {
  const rows = parseCsv(text)
  const header = rows[0]?.map((h) => h.trim())
  if (!header) return { records: [], headerError: 'CSVが空です' }
  const missing = requiredHeaders.filter((h) => !header.includes(h))
  if (missing.length) return { records: [], headerError: `必須の列がありません: ${missing.join(', ')}` }
  const allowed = new Set([...requiredHeaders, ...optionalHeaders])
  const unknown = header.filter((h) => !allowed.has(h))
  if (unknown.length) return { records: [], headerError: `不明な列があります: ${unknown.join(', ')}` }
  const records = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
  return { records, headerError: null }
}

/** 式インジェクション対策で付けた先頭の ' を戻す（エクスポートしたCSVを再取り込みする場合） */
export function unescapeFormulaGuard(v: string): string {
  return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v
}
