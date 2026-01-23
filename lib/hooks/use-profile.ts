'use client'

import { useQuery } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'

type Profile = {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  role: string
  theme?: 'system' | 'accented'
}

async function fetchProfile(): Promise<Profile | null> {
  const response = await fetch('/api/setup/profile')

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data?.profile || null
}

export function useProfile() {
  const schoolId = useSchool()

  return useQuery({
    queryKey: ['profile', schoolId],
    queryFn: fetchProfile,
    staleTime: Infinity, // Never goes stale - only refetch on manual invalidation
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
  })
}
