import { notFound } from 'next/navigation'
import { getTimeSlotById } from '@/lib/api/timeslots'
import TimeSlotFormClient from './TimeSlotFormClient'
import { isTimeSlotUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

export default async function TimeSlotDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  let timeslot
  try {
    timeslot = await getTimeSlotById(id)
  } catch {
    notFound()
  }

  const timeSlotWithInactive = timeslot as typeof timeslot & { is_active?: boolean | null }
  const isInactive = timeSlotWithInactive.is_active === false
  const showInactiveBaselineWarning = isInactive
    ? await isTimeSlotUsedInBaselineSchedule(timeslot.id, {
        schoolId: timeslot.school_id ?? undefined,
      })
    : false

  return (
    <TimeSlotFormClient
      timeslot={timeslot}
      isInactive={isInactive}
      showInactiveBaselineWarning={showInactiveBaselineWarning}
    />
  )
}
