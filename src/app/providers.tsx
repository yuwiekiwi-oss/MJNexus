import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { AuthProvider } from '@/features/auth/auth-context'
import type { MjSupabaseClient } from '@/lib/supabase'
import { ThemeProvider } from './theme'

// oxlint-disable-next-line react/only-export-components
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
  })
}

export function AppProviders({ client, children }: { client: MjSupabaseClient | null; children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={client}>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
