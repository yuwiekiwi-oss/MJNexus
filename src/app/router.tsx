import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { InquiryDetailPage } from '@/features/marketing/inquiry-detail-page'
import { InquiryFormPage } from '@/features/marketing/inquiry-form-page'
import { MarketingPage } from '@/features/marketing/marketing-page'
import { ContentPlannerPage } from '@/features/content-planner/content-planner-page'
import { PostDetailPage } from '@/features/social/post-detail-page'
import { PostFormPage } from '@/features/social/post-form-page'
import { SocialPage } from '@/features/social/social-page'
import { LoginPage } from '@/features/auth/login-page'
import { RequireAuth } from '@/features/auth/require-auth'
import { ALL_NAV_ITEMS } from '@/lib/nav'
import { ComingSoonPage } from '@/pages/coming-soon-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { OverviewPage } from '@/pages/overview-page'
import { SettingsPage } from '@/pages/settings-page'

const comingSoonRoutes: RouteObject[] = ALL_NAV_ITEMS.filter((i) => i.status === 'coming_soon').map((item) => ({
  path: item.path.slice(1),
  element: <ComingSoonPage item={item} />,
}))

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
      { index: true, element: <OverviewPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'social', element: <SocialPage /> },
      { path: 'social/posts/new', element: <PostFormPage /> },
      { path: 'social/posts/:id', element: <PostDetailPage /> },
      { path: 'social/posts/:id/edit', element: <PostFormPage /> },
      { path: 'content-planner', element: <ContentPlannerPage /> },
      { path: 'marketing', element: <MarketingPage /> },
      { path: 'marketing/inquiries/new', element: <InquiryFormPage /> },
      { path: 'marketing/inquiries/:id', element: <InquiryDetailPage /> },
      ...comingSoonRoutes,
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
