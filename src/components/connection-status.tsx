import { CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { supabaseEnv } from '@/lib/env'

export type ConnectionState = 'connected' | 'not_connected' | 'error'

export interface ConnectionInfo {
  id: string
  name: string
  state: ConnectionState
  detail: string
}

/** 外部サービスの接続状況。フロントエンドで確認できない項目は推測せず「未接続」と表示する */
// oxlint-disable-next-line react/only-export-components
export function getConnections(): ConnectionInfo[] {
  const supabase: ConnectionInfo =
    supabaseEnv.status === 'configured'
      ? { id: 'supabase', name: 'Supabase', state: 'connected', detail: new URL(supabaseEnv.url).host }
      : supabaseEnv.status === 'invalid'
        ? { id: 'supabase', name: 'Supabase', state: 'error', detail: supabaseEnv.reason }
        : {
            id: 'supabase',
            name: 'Supabase',
            state: 'not_connected',
            detail: '.env.local に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定してください。',
          }
  return [supabase]
}

const STATE_UI: Record<ConnectionState, { label: string; variant: 'success' | 'outline' | 'destructive' }> = {
  connected: { label: '接続済み', variant: 'success' },
  not_connected: { label: '未接続', variant: 'outline' },
  error: { label: '設定エラー', variant: 'destructive' },
}

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const ui = STATE_UI[state]
  const Icon = state === 'connected' ? CircleCheck : state === 'error' ? TriangleAlert : CircleDashed
  return (
    <Badge variant={ui.variant}>
      <Icon /> {ui.label}
    </Badge>
  )
}
