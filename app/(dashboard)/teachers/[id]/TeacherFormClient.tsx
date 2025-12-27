'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import TeacherForm from '@/components/teachers/TeacherForm'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']

interface TeacherFormClientProps {
  teacher: Staff
}

export default function TeacherFormClient({ teacher }: TeacherFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: any) => {
    try {
      setError(null)
      // Convert empty email to null
      const payload = {
        ...data,
        email: data.email && data.email.trim() !== '' ? data.email : null,
        is_teacher: true, // Always true when updating from teacher form
        is_sub: data.is_sub ?? false, // Include the checkbox value
        role_type_id: data.role_type_id, // Include the role type
      }
      const response = await fetch(`/api/teachers/${teacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update teacher')
      }

      router.push('/teachers')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this teacher?')) return

    try {
      setError(null)
      const response = await fetch(`/api/teachers/${teacher.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete teacher')
      }

      router.push('/teachers')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Teacher</h1>
        <p className="text-muted-foreground mt-2">
          {teacher.display_name || `${teacher.first_name} ${teacher.last_name}`}
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <TeacherForm teacher={teacher} onSubmit={handleSubmit} onCancel={() => router.push('/teachers')} />
        <div className="mt-6 pt-6 border-t">
          <button
            onClick={handleDelete}
            className="text-sm text-destructive hover:underline"
          >
            Delete Teacher
          </button>
        </div>
      </div>
    </div>
  )
}

