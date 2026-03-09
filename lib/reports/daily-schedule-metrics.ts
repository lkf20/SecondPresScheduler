type CellClassGroup = {
  id: string
  name: string
  age_unit: 'months' | 'years'
  min_age: number | null
  max_age: number | null
  required_ratio: number
  preferred_ratio: number | null
  enrollment?: number | null
}

type SlotAssignmentMetrics = {
  enrollment?: number | null
}

type SlotMetricsInput =
  | {
      schedule_cell?: {
        enrollment_for_staffing?: number | null
        class_groups?: CellClassGroup[] | null
      } | null
      assignments?: SlotAssignmentMetrics[] | null
    }
  | null
  | undefined

const compactGroupName = (name: string) => name.replace(/\s+Room$/i, '').trim()

const getSortedClassGroupsByAge = (groups: CellClassGroup[]) =>
  [...groups].sort((a, b) => {
    const aAge =
      a.min_age === null ? Number.POSITIVE_INFINITY : a.min_age * (a.age_unit === 'years' ? 12 : 1)
    const bAge =
      b.min_age === null ? Number.POSITIVE_INFINITY : b.min_age * (b.age_unit === 'years' ? 12 : 1)
    if (aAge !== bAge) return aAge - bAge
    return a.name.localeCompare(b.name)
  })

export const getEnrollmentSummary = (slot: SlotMetricsInput) => {
  const classGroups = getSortedClassGroupsByAge(
    (slot?.schedule_cell?.class_groups || []) as CellClassGroup[]
  )
  const classGroupNames = classGroups.map(group => compactGroupName(group.name))
  const classGroupEnrollment = classGroups.filter(group => typeof group.enrollment === 'number')

  if (classGroupEnrollment.length > 0) {
    return classGroupEnrollment
      .map(group => `${compactGroupName(group.name)} (${group.enrollment})`)
      .join(', ')
  }

  if (
    typeof slot?.schedule_cell?.enrollment_for_staffing === 'number' &&
    classGroupNames.length > 0
  ) {
    return `${classGroupNames.join(', ')} (${slot.schedule_cell.enrollment_for_staffing})`
  }

  if (typeof slot?.schedule_cell?.enrollment_for_staffing === 'number') {
    return `Enrollment (${slot.schedule_cell.enrollment_for_staffing})`
  }

  const assignmentEnrollment = slot?.assignments?.find(
    assignment => typeof assignment.enrollment === 'number'
  )?.enrollment

  if (typeof assignmentEnrollment === 'number') {
    return classGroupNames.length > 0
      ? `${classGroupNames.join(', ')} (${assignmentEnrollment})`
      : `Enrollment (${assignmentEnrollment})`
  }

  return null
}

export const getYoungestRatioGroup = (slot: SlotMetricsInput): CellClassGroup | null => {
  const classGroups = getSortedClassGroupsByAge(
    (slot?.schedule_cell?.class_groups || []) as CellClassGroup[]
  )
  const withRatio = classGroups.filter(
    group => typeof group.required_ratio === 'number' || typeof group.preferred_ratio === 'number'
  )
  return withRatio[0] ?? null
}

export const formatRatioSummary = ({
  showRequiredRatios,
  showPreferredRatios,
  requiredRatio,
  preferredRatio,
}: {
  showRequiredRatios: boolean
  showPreferredRatios: boolean
  requiredRatio: number | null | undefined
  preferredRatio: number | null | undefined
}) => {
  const hasRequired = showRequiredRatios && typeof requiredRatio === 'number'
  const hasPreferred = showPreferredRatios && typeof preferredRatio === 'number'
  if (!hasRequired && !hasPreferred) return null
  if (hasRequired && hasPreferred) return `1:${requiredRatio} (R) 1:${preferredRatio} (P)`
  if (hasRequired) return `1:${requiredRatio}`
  return `1:${preferredRatio}`
}
