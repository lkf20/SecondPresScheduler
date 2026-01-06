import { notFound } from 'next/navigation'
import { getTeacherScheduleById } from '@/lib/api/schedules'
import ScheduleFormClient from './ScheduleFormClient'

export default async function ScheduleDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  let schedule
  try {
    schedule = await getTeacherScheduleById(id)
  } catch (error) {
    notFound()
  }

  return <ScheduleFormClient schedule={schedule} />
}
