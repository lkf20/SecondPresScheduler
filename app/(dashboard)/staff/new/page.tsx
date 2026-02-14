'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import StaffForm, { type StaffFormData } from '@/components/staff/StaffForm'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { Database } from '@/types/database'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'

export default function NewStaffPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [roleTypes, setRoleTypes] = useState<
    Database['public']['Tables']['staff_role_types']['Row'][]
  >([])
  const [defaultFormat, setDefaultFormat] = useState<DisplayNameFormat>('first_last_initial')

  useEffect(() => {
    const fetchRoleTypes = async () => {
      try {
        const response = await fetch('/api/staff-role-types')
        if (!response.ok) return
        const data = await response.json()
        setRoleTypes(data)
      } catch (err) {
        console.error('Failed to fetch staff role types', err)
      }
    }
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/schedule-settings')
        if (!response.ok) return
        const data = await response.json()
        if (data?.default_display_name_format) {
          setDefaultFormat(data.default_display_name_format)
        }
      } catch (err) {
        console.error('Failed to fetch schedule settings', err)
      }
    }
    fetchRoleTypes()
    fetchSettings()
  }, [])

  const handleSubmit = async (data: StaffFormData) => {
    try {
      setError(null)
      const roleCodes = (data.role_type_ids || [])
        .map(id => roleTypes.find(role => role.id === id)?.code)
        .filter(Boolean) as string[]
      const isTeacherRole = roleCodes.includes('PERMANENT') || roleCodes.includes('FLEXIBLE')

      const payload = {
        ...data,
        email: data.email && data.email.trim() !== '' ? data.email : null,
        is_teacher: isTeacherRole,
        is_sub: data.is_sub ?? false,
        role_type_ids: data.role_type_ids,
      }

      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create staff')
      }

      router.push('/staff')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create staff')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add Staff Member</h1>
        <p className="text-muted-foreground mt-2">Create a new staff profile</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <StaffForm
          onSubmit={handleSubmit}
          onCancel={() => router.push('/staff')}
          defaultDisplayNameFormat={defaultFormat}
        />
      </div>
    </div>
  )
}
