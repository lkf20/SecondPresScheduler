import { notFound } from 'next/navigation'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import TimeOffFormClient from './TimeOffFormClient'

export default async function TimeOffDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  let timeOffRequest
  try {
    timeOffRequest = await getTimeOffRequestById(id)
  } catch (error) {
    notFound()
  }

  return <TimeOffFormClient timeOffRequest={timeOffRequest} />
}
