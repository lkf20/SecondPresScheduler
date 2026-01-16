'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CalendarPlus, LogOut, UserPlus, UserSearch } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { usePanelManager } from '@/lib/contexts/PanelManagerContext'
import TimeOffForm from '@/components/time-off/TimeOffForm'

interface HeaderProps {
  userEmail?: string
}

export default function Header({ userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isTimeOffSheetOpen, setIsTimeOffSheetOpen] = useState(false)
  const { activePanel, savePreviousPanel, restorePreviousPanel, setActivePanel, requestPanelClose } = usePanelManager()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleTimeOffSuccess = (teacherName: string, startDate: string, endDate: string) => {
    // Format date range for toast
    const formatDateForToast = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    const startDateFormatted = formatDateForToast(startDate)
    const endDateFormatted = formatDateForToast(endDate)
    const dateRange = startDateFormatted === endDateFormatted 
      ? startDateFormatted 
      : `${startDateFormatted}-${endDateFormatted}`
    
    // Close the sheet
    setIsTimeOffSheetOpen(false)
    
    // Show toast
    toast.success(`Time off added for ${teacherName} (${dateRange})`)
    
    // Refresh the current page to update data
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
            <Button 
              size="sm" 
              variant="outline" 
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => {
                // If another panel is open, save it and close it before opening Add Time Off
                if (activePanel && activePanel !== 'time-off') {
                  savePreviousPanel(activePanel)
                  requestPanelClose(activePanel)
                }
                setActivePanel('time-off')
                setIsTimeOffSheetOpen(true)
              }}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Add Time Off
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

      <Sheet 
        open={isTimeOffSheetOpen} 
        onOpenChange={(open) => {
          setIsTimeOffSheetOpen(open)
          if (!open) {
            // When Add Time Off closes, restore the previous panel if there was one
            setActivePanel(null)
            // Use setTimeout to ensure the sheet closes before restoring
            setTimeout(() => {
              restorePreviousPanel()
            }, 100)
          }
        }}
      >
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-2xl h-screen flex flex-col p-0 [&>button]:top-4 [&>button]:right-4"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-3xl font-bold tracking-tight text-slate-900">
                Add Time Off Request
              </SheetTitle>
              <SheetDescription>
                Create a new time off request
              </SheetDescription>
            </SheetHeader>
            <TimeOffForm 
              onSuccess={handleTimeOffSuccess}
              onCancel={() => setIsTimeOffSheetOpen(false)}
              showBackLink={false}
            />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
