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
  Pin,
  PinOff,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/contexts/ThemeContext'

const SETTINGS_LAST_PATH_KEY = 'settingsLastPath'
const SETTINGS_LAST_PATH_TIMESTAMP_KEY = 'settingsLastPathTimestamp'
const SETTINGS_LAST_PATH_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

const isSettingsAreaPath = (path: string) =>
  path === '/settings' ||
  path.startsWith('/settings/') ||
  path === '/staff' ||
  path.startsWith('/staff/')

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
  const [isPinned, setIsPinned] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [suppressHover, setSuppressHover] = useState(false)
  const [settingsDestination, setSettingsDestination] = useState('/settings')
  const isExpanded = isPinned || isHovered

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.sessionStorage.getItem('sidebarPinned')
    if (stored !== null) {
      setIsPinned(stored === 'true')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const layoutWidth = isPinned ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)'
    const visualWidth = isExpanded ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)'
    document.documentElement.style.setProperty('--sidebar-layout-width', layoutWidth)
    document.documentElement.style.setProperty('--sidebar-visual-width', visualWidth)
    window.sessionStorage.setItem('sidebarPinned', String(isPinned))
  }, [isPinned, isExpanded])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!pathname || !isSettingsAreaPath(pathname)) return
    if (pathname === '/settings') return

    window.sessionStorage.setItem(SETTINGS_LAST_PATH_KEY, pathname)
    window.sessionStorage.setItem(SETTINGS_LAST_PATH_TIMESTAMP_KEY, String(Date.now()))
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const lastPath = window.sessionStorage.getItem(SETTINGS_LAST_PATH_KEY)
    const lastTimestampRaw = window.sessionStorage.getItem(SETTINGS_LAST_PATH_TIMESTAMP_KEY)
    const lastTimestamp = lastTimestampRaw ? Number.parseInt(lastTimestampRaw, 10) : NaN

    if (!lastPath || Number.isNaN(lastTimestamp)) {
      setSettingsDestination('/settings')
      return
    }
    if (!isSettingsAreaPath(lastPath)) {
      setSettingsDestination('/settings')
      return
    }
    if (Date.now() - lastTimestamp > SETTINGS_LAST_PATH_TTL_MS) {
      setSettingsDestination('/settings')
      return
    }

    setSettingsDestination(lastPath)
  }, [pathname])

  return (
    <aside
      className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:pt-16 md:z-40"
      style={{ width: 'var(--sidebar-visual-width)' }}
      onMouseEnter={() => {
        if (suppressHover) return
        setIsHovered(true)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        setSuppressHover(false)
      }}
    >
      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 border-r transition-[width,colors,box-shadow] duration-200',
          isAccented ? 'bg-sidebar-bg border-sidebar-hover' : 'bg-background border-border',
          !isPinned && isExpanded && 'shadow-[6px_0_18px_rgba(15,23,42,0.12)]'
        )}
      >
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className={cn('px-2', 'flex justify-start min-h-[44px]')}>
            {isExpanded && (
              <button
                type="button"
                aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                className={cn(
                  'mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isAccented && 'hover:bg-sidebar-hover hover:text-sidebar-foreground'
                )}
                onClick={() => setIsPinned(prev => !prev)}
              >
                {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            )}
          </div>
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map(item => {
              const isSettingsItem = item.name === 'Settings'
              const itemHref = isSettingsItem
                ? pathname && isSettingsAreaPath(pathname)
                  ? '/settings'
                  : settingsDestination
                : item.href
              const isActive = isSettingsItem
                ? Boolean(pathname && isSettingsAreaPath(pathname))
                : pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={itemHref}
                  prefetch={true}
                  onClick={() => {
                    if (!isPinned) {
                      setIsHovered(false)
                      setSuppressHover(true)
                    }
                  }}
                  className={cn(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    !isExpanded && 'justify-center px-2',
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
                      'h-5 w-5 flex-shrink-0',
                      isExpanded && 'mr-3',
                      isAccented
                        ? isActive
                          ? 'text-sidebar-active-foreground'
                          : 'text-sidebar-foreground'
                        : isActive
                          ? 'text-accent-foreground'
                          : 'text-muted-foreground'
                    )}
                  />
                  {isExpanded && item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
