import { notFound } from 'next/navigation'
import { getTeacherById } from '@/lib/api/teachers'
import TeacherFormClient from './TeacherFormClient'

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let teacher
  try {
    teacher = await getTeacherById(id)
  } catch (error) {
    notFound()
  }

  return <TeacherFormClient teacher={teacher} />
}



