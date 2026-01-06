import { notFound } from 'next/navigation'
import { getTimeSlotById } from '@/lib/api/timeslots'
import TimeSlotFormClient from './TimeSlotFormClient'

export default async function TimeSlotDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  let timeslot
  try {
    timeslot = await getTimeSlotById(id)
  } catch (error) {
    notFound()
  }

  return <TimeSlotFormClient timeslot={timeslot} />
}
