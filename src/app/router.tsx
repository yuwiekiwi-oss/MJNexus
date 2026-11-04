import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { InquiryDetailPage } from '@/features/marketing/inquiry-detail-page'
import { InquiryFormPage } from '@/features/marketing/inquiry-form-page'
import { MarketingPage } from '@/features/marketing/marketing-page'
import { LoginPage } from '@/features/auth/login-page'
import { RequireAuth } from '@/features/auth/require-auth'
import { NotFoundPage } from '@/pages/not-found-page'
import { SettingsPage } from '@/pages/settings-page'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/marketing" replace /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'marketing', element: <MarketingPage /> },
      { path: 'marketing/inquiries/new', element: <InquiryFormPage /> },
      { path: 'marketing/inquiries/:id', element: <InquiryDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

/**
 * VITE_ROUTER_MODE=memory はURLに依存しないプレビュー用（埋め込み表示など）。
 * 通常は URL と連動する BrowserRouter を使う。
 */
export function createAppRouter() {
  return import.meta.env.VITE_ROUTER_MODE === 'memory' ? createMemoryRouter(routes) : createBrowserRouter(routes)
}
