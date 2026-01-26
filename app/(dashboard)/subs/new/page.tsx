'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import SubForm, { type SubFormData } from '@/components/subs/SubForm'
import ErrorMessage from '@/components/shared/ErrorMessage'

export default function NewSubPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: SubFormData) => {
    try {
      setError(null)
      // Convert empty email to null (id isn't part of SubFormData)
      const payload = {
        ...data,
        email: data.email && data.email.trim() !== '' ? data.email : null,
        is_sub: true, // Always true when creating from sub form
        is_teacher: data.is_teacher ?? false, // Include the checkbox value
      }
      const response = await fetch('/api/subs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create sub')
      }

      router.push('/subs')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create sub')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add New Sub</h1>
        <p className="text-muted-foreground mt-2">Create a new substitute teacher profile</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <SubForm onSubmit={handleSubmit} onCancel={() => router.push('/subs')} />
      </div>
    </div>
  )
}
