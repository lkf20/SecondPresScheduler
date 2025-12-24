import { notFound } from 'next/navigation'
import { getTimeSlotById } from '@/lib/api/timeslots'
import TimeSlotFormClient from './TimeSlotFormClient'

export default async function TimeSlotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let timeslot
  try {
    timeslot = await getTimeSlotById(id)
  } catch (error) {
    notFound()
  }

  return <TimeSlotFormClient timeslot={timeslot} />
}

