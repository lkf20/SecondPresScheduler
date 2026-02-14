import StaffPageClient from '@/components/staff/StaffPageClient'
import { getStaff, type StaffWithRole } from '@/lib/api/staff'
import { getScheduleSettings } from '@/lib/api/schedule-settings'

export default async function StaffPage() {
  let staff: StaffWithRole[] = []
  let error: string | null = null

  try {
    staff = await getStaff()
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : 'Failed to load staff'
    console.error('Error loading staff:', err)
  }

  const schoolId = staff[0]?.school_id
  const scheduleSettings = schoolId ? await getScheduleSettings(schoolId) : null

  return (
    <StaffPageClient
      staff={staff}
      error={error}
      defaultDisplayNameFormat={scheduleSettings?.default_display_name_format}
    />
  )
}
