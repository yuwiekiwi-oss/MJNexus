import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { createAppRouter } from '@/app/router'
import { type MjSupabaseClient, supabase } from '@/lib/supabase'
import './index.css'

const router = createAppRouter()

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

/**
 * VITE_DEMO_MODE=true のときだけ、サンプルデータの読み取り専用クライアントを使う（プレビュー用）。
 * 動的 import のため、通常ビルドにはサンプルデータが含まれない。
 */
async function resolveClient(): Promise<MjSupabaseClient | null> {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return (await import('@/demo/demo-client')).demoClient
  return supabase
}

void resolveClient().then((client) =>
  createRoot(root).render(
    <StrictMode>
      <AppProviders client={client}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  ),
)
