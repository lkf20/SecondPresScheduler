import StaffPageClient from '@/components/staff/StaffPageClient'
import { getStaff, type StaffWithRole } from '@/lib/api/staff'

export default async function StaffPage() {
  let staff: StaffWithRole[] = []
  let error: string | null = null

  try {
    staff = await getStaff()
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : 'Failed to load staff'
    console.error('Error loading staff:', err)
  }

  return <StaffPageClient staff={staff} error={error} />
}
