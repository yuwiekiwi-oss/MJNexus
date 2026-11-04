import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { createAppRouter } from '@/app/router'
import { supabase } from '@/lib/supabase'
import './index.css'

const router = createAppRouter()

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

createRoot(root).render(
  <StrictMode>
    <AppProviders client={supabase}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
