import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
    <div>
      <div className="mb-4">
        <Link
          href="/settings/classes"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Class Groups
        </Link>
      </div>
      <ClassGroupForm
        mode="edit"
        classData={classData}
        showInactiveBaselineWarning={showInactiveBaselineWarning}
      />
    </div>
  )
}
