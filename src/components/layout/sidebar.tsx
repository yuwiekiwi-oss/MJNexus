import { Hexagon } from 'lucide-react'
import { NavLink } from 'react-router'
import { NAV_ITEMS, type NavItem, SETTINGS_ITEM } from '@/lib/nav'
import { cn } from '@/lib/utils'

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Hexagon className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">MJ Nexus</div>
          <div className="text-[11px] text-muted-foreground">School Intelligence</div>
        </div>
      </div>
      <nav aria-label="メインメニュー" className="flex-1 space-y-5 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.id} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <SidebarLink item={SETTINGS_ITEM} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar md:block">
      <SidebarContent />
    </aside>
  )
}
