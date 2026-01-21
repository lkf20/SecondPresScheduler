'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import TimeOffForm from '@/components/time-off/TimeOffForm'

export default function NewTimeOffPage() {
  const router = useRouter()

  const handleSuccess = (teacherName: string, startDate: string, endDate: string) => {
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
    
    // Show toast
    toast.success(`Time off added for ${teacherName} (${dateRange})`)
    
    // Navigate and refresh
    router.push('/time-off')
    router.refresh()
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/time-off" className="inline-flex items-center text-sm text-muted-foreground hover:text-slate-900">
          ← Back to Time Off
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add Time Off Request</h1>
        <p className="text-muted-foreground mt-2">Create a new time off request</p>
      </div>

      <div className="max-w-2xl">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-6">
          <TimeOffForm 
            onSuccess={handleSuccess}
            showBackLink={false}
          />
        </div>
      </div>
    </div>
  )
}
