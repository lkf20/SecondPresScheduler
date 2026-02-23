import { notFound } from 'next/navigation'
import { getTimeSlotById } from '@/lib/api/timeslots'
import TimeSlotForm from '@/components/settings/TimeSlotForm'
import { isTimeSlotUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

export default async function TimeSlotDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  let timeslot
  try {
    timeslot = await getTimeSlotById(id)
  } catch {
    notFound()
  }

  const isInactive = timeslot.is_active === false
  const showInactiveBaselineWarning = isInactive
    ? await isTimeSlotUsedInBaselineSchedule(timeslot.id, {
        schoolId: timeslot.school_id ?? undefined,
      })
    : false

  return (
    <TimeSlotForm
      mode="edit"
      timeSlot={timeslot}
      showInactiveBaselineWarning={showInactiveBaselineWarning}
    />
  )
}
