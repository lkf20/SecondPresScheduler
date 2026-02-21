import { notFound } from 'next/navigation'
import { getClassroomById } from '@/lib/api/classrooms'
import ClassroomForm from '@/components/settings/ClassroomForm'

export default async function ClassroomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let classroom
  try {
    classroom = await getClassroomById(id)
  } catch {
    notFound()
  }

  return <ClassroomForm mode="edit" classroom={classroom} />
}
