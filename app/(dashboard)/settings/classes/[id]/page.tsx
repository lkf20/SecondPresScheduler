import { notFound } from 'next/navigation'
import { getClassGroupById } from '@/lib/api/class-groups'
import ClassGroupForm from '@/components/settings/ClassGroupForm'
import { isClassGroupUsedInBaselineSchedule } from '@/lib/api/baseline-usage'

export default async function ClassDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  let classData
  try {
    classData = await getClassGroupById(id)
  } catch {
    notFound()
  }

  const showInactiveBaselineWarning =
    classData.is_active === false
      ? await isClassGroupUsedInBaselineSchedule(classData.id, {
          schoolId: classData.school_id ?? undefined,
        })
      : false

  return (
    <ClassGroupForm
      mode="edit"
      classData={classData}
      showInactiveBaselineWarning={showInactiveBaselineWarning}
    />
  )
}
