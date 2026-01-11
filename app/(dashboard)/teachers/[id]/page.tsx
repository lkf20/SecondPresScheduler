import { notFound } from 'next/navigation'
import { getTeacherById } from '@/lib/api/teachers'
import TeacherFormClient from './TeacherFormClient'

export default async function TeacherDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  let teacher
  try {
    teacher = await getTeacherById(id)
  } catch {
    notFound()
  }

  return <TeacherFormClient teacher={teacher} />
}
