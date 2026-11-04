import { Menu, PlugZap } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/auth-context'
import { findNavItem } from '@/lib/nav'
import { Sidebar, SidebarContent } from './sidebar'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

function ConnectionBanner() {
  const { state } = useAuth()
  if (state.status !== 'unconfigured') return null
  return (
    <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs sm:px-6">
      <PlugZap className="size-3.5 shrink-0 text-warning" />
      <span>
        <strong className="font-medium">Supabase未接続</strong>
        ：画面の確認のみ可能です。データの保存・ログインは接続後に利用できます。
      </span>
      <Link to="/settings" className="ml-auto shrink-0 font-medium text-primary hover:underline">
        設定方法
      </Link>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const current = findNavItem(location.pathname)

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="md:pl-60">
        <ConnectionBanner />
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="メニューを開く">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" title="メインメニュー">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 truncate text-sm">
            <span className="text-muted-foreground">{current?.module ?? 'MJ Nexus'}</span>
            {current && (
              <>
                <span className="mx-1.5 text-muted-foreground/50">/</span>
                <span className="font-medium">{current.label}</span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main key={location.pathname} className="animate-page mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
