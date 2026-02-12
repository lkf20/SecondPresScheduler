import { getTeachers, StaffWithRole } from '@/lib/api/teachers'
import TeachersPageClient from '@/components/teachers/TeachersPageClient'

export default async function TeachersPage() {
  let teachers: StaffWithRole[] = []
  let error: string | null = null

  try {
    teachers = await getTeachers()
    // Add computed fields
    teachers = teachers.map(teacher => {
      const roleLabels =
        teacher.staff_role_type_assignments
          ?.map(assignment => assignment.staff_role_types?.label)
          .filter((label): label is string => Boolean(label))
          .join(', ') || '—'
      return {
        ...teacher,
        role_type_label: roleLabels,
        full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || '—',
      }
    })
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : 'Failed to load teachers'
    console.error('Error loading teachers:', err)
  }

  return <TeachersPageClient teachers={teachers} error={error} />
}
