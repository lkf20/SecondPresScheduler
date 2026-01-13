'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CalendarPlus, LogOut, UserPlus, UserSearch } from 'lucide-react'

interface HeaderProps {
  userEmail?: string
}

export default function Header({ userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Scheduler</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <Link href="/time-off/new">
                <CalendarPlus className="h-4 w-4 mr-2" />
                Add Time Off
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <Link href="/sub-finder">
                <UserSearch className="h-4 w-4 mr-2" />
                Find Sub
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <Link href="/schedules/weekly">
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Sub
              </Link>
            </Button>
          </div>
          {userEmail && (
            <span className="text-sm text-muted-foreground">{userEmail}</span>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
