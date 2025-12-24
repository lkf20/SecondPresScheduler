import { notFound } from 'next/navigation'
import { getClassroomById } from '@/lib/api/classrooms'
import ClassroomFormClient from './ClassroomFormClient'

export default async function ClassroomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let classroom
  try {
    classroom = await getClassroomById(id)
  } catch (error) {
    notFound()
  }

  return <ClassroomFormClient classroom={classroom} />
}

