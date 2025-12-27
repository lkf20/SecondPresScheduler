'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import TeacherScheduleForm from '@/components/schedules/TeacherScheduleForm'
import ErrorMessage from '@/components/shared/ErrorMessage'

interface ScheduleFormClientProps {
  schedule: any
}

export default function ScheduleFormClient({ schedule }: ScheduleFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: any) => {
    try {
      setError(null)
      const response = await fetch(`/api/teacher-schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update schedule')
      }

      router.push('/schedules')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this schedule entry?')) return

    try {
      setError(null)
      const response = await fetch(`/api/teacher-schedules/${schedule.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete schedule')
      }

      router.push('/schedules')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Schedule</h1>
        <p className="text-muted-foreground mt-2">
          {schedule.teacher?.display_name || 
           (schedule.teacher?.first_name && schedule.teacher?.last_name
             ? `${schedule.teacher.first_name} ${schedule.teacher.last_name}`
             : 'Schedule Entry')}
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <TeacherScheduleForm schedule={schedule} onSubmit={handleSubmit} onCancel={() => router.push('/schedules')} />
        <div className="mt-6 pt-6 border-t">
          <button
            onClick={handleDelete}
            className="text-sm text-destructive hover:underline"
          >
            Delete Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

