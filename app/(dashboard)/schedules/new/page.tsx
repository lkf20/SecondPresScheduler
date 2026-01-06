'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import TeacherScheduleForm from '@/components/schedules/TeacherScheduleForm'
import ErrorMessage from '@/components/shared/ErrorMessage'

export default function NewSchedulePage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: any) => {
    try {
      setError(null)
      const response = await fetch('/api/teacher-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create schedule')
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
        <h1 className="text-3xl font-bold tracking-tight">Add Schedule</h1>
        <p className="text-muted-foreground mt-2">Create a new teacher schedule entry</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <TeacherScheduleForm onSubmit={handleSubmit} onCancel={() => router.push('/schedules')} />
      </div>
    </div>
  )
}
