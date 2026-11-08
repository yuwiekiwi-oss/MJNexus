/** どこまで進んだか。見送りになっても、到達した段はそのまま残す。 */
export const STAGES = ['line', 'applied', 'attended', 'enrolled'] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABELS: Record<Stage, string> = {
  line: 'LINE追加のみ',
  applied: '体験申込',
  attended: '体験参加',
  enrolled: '入会',
}

export const CHANNELS = ['Instagram', '検索', '紹介・口コミ', 'チラシ・その他'] as const
export type Channel = (typeof CHANNELS)[number]

export const GRADES = ['小1', '小2', '小3', '小4', '小5', '小6', '中1', '中2', '中3', 'その他'] as const

export interface Student {
  id: string
  name: string
  grade: string
  channel: Channel
  /** YYYY-MM-DD */
  lineAddedOn: string
  stage: Stage
  declined: boolean
  /** 状態を最後に変えた日時（ISO）。自動で記録する。 */
  statusChangedAt: string
}

export type StudentInput = Omit<Student, 'id' | 'statusChangedAt'>

/** 画面で選ぶ「状態」。見送りは到達段とは別に持つ。 */
export type Status = Stage | 'declined'

export const STATUS_OPTIONS: Status[] = ['line', 'applied', 'attended', 'enrolled', 'declined']

export function statusOf(s: Pick<Student, 'stage' | 'declined'>): Status {
  return s.declined ? 'declined' : s.stage
}

export function statusLabel(status: Status): string {
  return status === 'declined' ? '見送り' : STAGE_LABELS[status]
}

/**
 * 画面で選んだ状態を、保存する stage / declined に変換する。
 * 見送りを選んだときは、それまでに到達した段を残す。
 */
export function applyStatus(current: Pick<Student, 'stage'> | null, status: Status): Pick<Student, 'stage' | 'declined'> {
  if (status === 'declined') return { stage: current?.stage ?? 'line', declined: true }
  return { stage: status, declined: false }
}
