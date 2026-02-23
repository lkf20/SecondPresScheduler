import { notFound } from 'next/navigation'
import { getClassroomById } from '@/lib/api/classrooms'
import ClassroomForm from '@/components/settings/ClassroomForm'
import { isClassroomUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

export default async function ClassroomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let classroom
  try {
    classroom = await getClassroomById(id)
  } catch {
    notFound()
  }

  const showInactiveBaselineWarning =
    classroom.is_active === false
      ? await isClassroomUsedInBaselineSchedule(classroom.id, {
          schoolId: classroom.school_id ?? undefined,
        })
      : false

  return (
    <ClassroomForm
      mode="edit"
      classroom={classroom}
      showInactiveBaselineWarning={showInactiveBaselineWarning}
    />
  )
}
