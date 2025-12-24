'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import SubForm from '@/components/subs/SubForm'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']

interface SubFormClientProps {
  sub: Staff
}

export default function SubFormClient({ sub }: SubFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: any) => {
    try {
      setError(null)
      const response = await fetch(`/api/subs/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update sub')
      }

      router.push('/subs')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this sub?')) return

    try {
      setError(null)
      const response = await fetch(`/api/subs/${sub.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete sub')
      }

      router.push('/subs')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Sub</h1>
        <p className="text-muted-foreground mt-2">
          {sub.display_name || `${sub.first_name} ${sub.last_name}`}
        </p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <SubForm sub={sub} onSubmit={handleSubmit} onCancel={() => router.push('/subs')} />
        <div className="mt-6 pt-6 border-t">
          <button
            onClick={handleDelete}
            className="text-sm text-destructive hover:underline"
          >
            Delete Sub
          </button>
        </div>
      </div>
    </div>
  )
}

