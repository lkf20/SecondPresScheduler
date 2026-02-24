import StaffFormClient from '@/components/staff/StaffFormClient'
import { getStaffById } from '@/lib/api/staff'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { isStaffUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await getStaffById(id).catch((error: any) => ({
    __error: error as Error,
  }))

  if ('__error' in staff) {
    return <ErrorMessage message={staff.__error.message || 'Failed to load staff'} />
  }

  const scheduleSettings = staff.school_id ? await getScheduleSettings(staff.school_id) : null
  const showInactiveBaselineWarning =
    staff.active === false
      ? await isStaffUsedInBaselineSchedule(staff.id, { schoolId: staff.school_id ?? undefined })
      : false

  return (
    <StaffFormClient
      staff={staff}
      defaultDisplayNameFormat={scheduleSettings?.default_display_name_format}
      showInactiveBaselineWarning={showInactiveBaselineWarning}
    />
  )
}
