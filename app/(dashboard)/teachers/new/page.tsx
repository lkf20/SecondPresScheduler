'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import TeacherForm from '@/components/teachers/TeacherForm'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function NewTeacherPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: any) => {
    try {
      setError(null)
      // Convert empty email to null and exclude id (should not be sent for new teachers)
      const { id, ...teacherData } = data
      const payload = {
        ...teacherData,
        email: data.email && data.email.trim() !== '' ? data.email : null,
        is_teacher: true, // Always true when creating from teacher form
        is_sub: data.is_sub ?? false, // Include the checkbox value
        role_type_id: data.role_type_id, // Include the role type
      }
      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create teacher')
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
        <h1 className="text-3xl font-bold tracking-tight">Add New Teacher</h1>
        <p className="text-muted-foreground mt-2">Create a new teacher profile</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <TeacherForm onSubmit={handleSubmit} onCancel={() => router.push('/teachers')} />
      </div>
    </div>
  )
}
