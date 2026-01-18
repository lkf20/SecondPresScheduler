'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Calendar,
  FileText,
  Settings,
  CalendarOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/contexts/ThemeContext'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Weekly Schedule', href: '/schedules/weekly', icon: Calendar },
  { name: 'Time Off', href: '/time-off', icon: CalendarOff },
  { name: 'Sub Finder', href: '/sub-finder', icon: Search },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { theme } = useTheme()
  const isAccented = theme === 'accented'

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:pt-16 md:z-40">
      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 border-r transition-colors',
          isAccented
            ? 'bg-sidebar-bg border-sidebar-hover'
            : 'bg-background border-border'
        )}
      >
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isAccented
                      ? isActive
                        ? 'bg-sidebar-active text-sidebar-active-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-hover'
                      : isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon
                    className={cn(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      isAccented
                        ? isActive
                          ? 'text-sidebar-active-foreground'
                          : 'text-sidebar-foreground'
                        : isActive
                        ? 'text-accent-foreground'
                        : 'text-muted-foreground'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
