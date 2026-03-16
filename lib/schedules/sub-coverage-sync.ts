import { getCellDateISO } from '@/lib/utils/date'

export type SubCoverageTuple = {
  sub_id: string
  teacher_id: string
  date: string
  time_slot: string
  classroom: string
}

export type AbsenceCoverageTuple = {
  teacher_id: string
  date: string
  time_slot: string
  classroom: string
  has_sub: boolean
}

export type ClosureEntry = {
  date: string
  time_slot_id?: string | null
  time_slot_code?: string | null
}

const normalizeToken = (value: string | null | undefined) => (value || '').trim().toLowerCase()

export const buildTupleKey = (tuple: SubCoverageTuple) =>
  [
    normalizeToken(tuple.sub_id),
    normalizeToken(tuple.teacher_id),
    normalizeToken(tuple.date),
    normalizeToken(tuple.time_slot),
    normalizeToken(tuple.classroom),
  ].join('|')

export const buildAbsenceTupleKey = (tuple: AbsenceCoverageTuple) =>
  [
    normalizeToken(tuple.teacher_id),
    normalizeToken(tuple.date),
    normalizeToken(tuple.time_slot),
    normalizeToken(tuple.classroom),
    tuple.has_sub ? '1' : '0',
  ].join('|')

const isClosed = (date: string, slotToken: string, closures: ClosureEntry[]) => {
  return closures.some(closure => {
    if (closure.date !== date) return false
    if (!closure.time_slot_id && !closure.time_slot_code) return true
    if (
      closure.time_slot_code &&
      normalizeToken(closure.time_slot_code) === normalizeToken(slotToken)
    ) {
      return true
    }
    if (
      closure.time_slot_id &&
      normalizeToken(closure.time_slot_id) === normalizeToken(slotToken)
    ) {
      return true
    }
    return false
  })
}

export const extractDashboardSubCoverageTuples = (
  dashboardResponse: {
    scheduled_subs?: Array<{
      sub_id?: string | null
      teacher_id?: string | null
      date?: string | null
      time_slot_code?: string | null
      classroom_name?: string | null
    }>
  },
  opts?: { closures?: ClosureEntry[] }
) => {
  const closures = opts?.closures || []
  const tuples: SubCoverageTuple[] = []
  for (const row of dashboardResponse.scheduled_subs || []) {
    if (!row.sub_id || !row.teacher_id || !row.date || !row.time_slot_code || !row.classroom_name) {
      continue
    }
    if (isClosed(row.date, row.time_slot_code, closures)) continue
    tuples.push({
      sub_id: row.sub_id,
      teacher_id: row.teacher_id,
      date: row.date,
      time_slot: row.time_slot_code,
      classroom: row.classroom_name,
    })
  }
  return dedupeTuples(tuples)
}

export const extractWeeklySubCoverageTuples = (
  weeklyResponse: {
    classrooms?: Array<{
      classroom_name: string
      days: Array<{
        day_number: number
        time_slots: Array<{
          time_slot_code: string
          time_slot_id?: string
          assignments: Array<{
            teacher_id?: string
            absent_teacher_id?: string
            is_substitute?: boolean
          }>
        }>
      }>
    }>
  },
  opts: { weekStartISO: string; closures?: ClosureEntry[] }
) => {
  const closures = opts.closures || []
  const tuples: SubCoverageTuple[] = []
  for (const classroom of weeklyResponse.classrooms || []) {
    for (const day of classroom.days || []) {
      const date = getCellDateISO(opts.weekStartISO, day.day_number)
      for (const slot of day.time_slots || []) {
        if (isClosed(date, slot.time_slot_code || slot.time_slot_id || '', closures)) continue
        for (const assignment of slot.assignments || []) {
          if (assignment.is_substitute !== true) continue
          if (!assignment.teacher_id || !assignment.absent_teacher_id) continue
          tuples.push({
            sub_id: assignment.teacher_id,
            teacher_id: assignment.absent_teacher_id,
            date,
            time_slot: slot.time_slot_code || '',
            classroom: classroom.classroom_name,
          })
        }
      }
    }
  }
  return dedupeTuples(tuples)
}

export const dedupeTuples = (tuples: SubCoverageTuple[]) => {
  const map = new Map<string, SubCoverageTuple>()
  for (const tuple of tuples) {
    map.set(buildTupleKey(tuple), tuple)
  }
  return Array.from(map.values()).sort((a, b) => buildTupleKey(a).localeCompare(buildTupleKey(b)))
}

export const compareSubCoverageTuples = (
  dashboardTuples: SubCoverageTuple[],
  weeklyTuples: SubCoverageTuple[]
) => {
  const dashboardKeys = new Set(dashboardTuples.map(buildTupleKey))
  const weeklyKeys = new Set(weeklyTuples.map(buildTupleKey))

  const missingInWeekly = Array.from(dashboardKeys).filter(key => !weeklyKeys.has(key))
  const missingInDashboard = Array.from(weeklyKeys).filter(key => !dashboardKeys.has(key))

  return {
    dashboardCount: dashboardKeys.size,
    weeklyCount: weeklyKeys.size,
    missingInWeekly,
    missingInDashboard,
    inSync: missingInWeekly.length === 0 && missingInDashboard.length === 0,
  }
}

export const dedupeAbsenceTuples = (tuples: AbsenceCoverageTuple[]) => {
  const map = new Map<string, AbsenceCoverageTuple>()
  for (const tuple of tuples) {
    map.set(buildAbsenceTupleKey(tuple), tuple)
  }
  return Array.from(map.values()).sort((a, b) =>
    buildAbsenceTupleKey(a).localeCompare(buildAbsenceTupleKey(b))
  )
}

export const extractDashboardAbsenceCoverageTuples = (
  dashboardResponse: {
    coverage_requests?: Array<{
      teacher_id?: string | null
      shift_details?: Array<{
        date?: string | null
        time_slot_id?: string | null
        time_slot_code?: string | null
        classroom_id?: string | null
        classroom_name?: string | null
        status?: 'covered' | 'partial' | 'uncovered' | string | null
      }>
    }>
  },
  opts?: { closures?: ClosureEntry[] }
) => {
  const closures = opts?.closures || []
  const tuples: AbsenceCoverageTuple[] = []

  for (const request of dashboardResponse.coverage_requests || []) {
    if (!request.teacher_id) continue
    for (const shift of request.shift_details || []) {
      if (!shift.date) continue
      const slotToken = shift.time_slot_id || shift.time_slot_code || ''
      const classroomToken = shift.classroom_id || shift.classroom_name || ''
      if (!slotToken || !classroomToken) continue
      if (isClosed(shift.date, slotToken, closures)) continue
      const hasSub = shift.status === 'covered' || shift.status === 'partial'
      tuples.push({
        teacher_id: request.teacher_id,
        date: shift.date,
        time_slot: slotToken,
        classroom: classroomToken,
        has_sub: hasSub,
      })
    }
  }

  return dedupeAbsenceTuples(tuples)
}

export const extractWeeklyAbsenceCoverageTuples = (
  weeklyResponse: {
    classrooms?: Array<{
      classroom_id?: string
      classroom_name?: string
      days: Array<{
        day_number: number
        time_slots: Array<{
          time_slot_id?: string
          time_slot_code?: string
          absences?: Array<{
            teacher_id?: string
            has_sub?: boolean
          }>
        }>
      }>
    }>
  },
  opts: { weekStartISO: string; closures?: ClosureEntry[] }
) => {
  const closures = opts.closures || []
  const tuples: AbsenceCoverageTuple[] = []

  for (const classroom of weeklyResponse.classrooms || []) {
    for (const day of classroom.days || []) {
      const date = getCellDateISO(opts.weekStartISO, day.day_number)
      for (const slot of day.time_slots || []) {
        const slotToken = slot.time_slot_id || slot.time_slot_code || ''
        const classroomToken = classroom.classroom_id || classroom.classroom_name || ''
        if (!slotToken || !classroomToken) continue
        if (isClosed(date, slotToken, closures)) continue

        for (const absence of slot.absences || []) {
          if (!absence.teacher_id) continue
          tuples.push({
            teacher_id: absence.teacher_id,
            date,
            time_slot: slotToken,
            classroom: classroomToken,
            has_sub: Boolean(absence.has_sub),
          })
        }
      }
    }
  }

  return dedupeAbsenceTuples(tuples)
}

export const compareAbsenceCoverageTuples = (
  dashboardTuples: AbsenceCoverageTuple[],
  weeklyTuples: AbsenceCoverageTuple[]
) => {
  const dashboardKeys = new Set(dashboardTuples.map(buildAbsenceTupleKey))
  const weeklyKeys = new Set(weeklyTuples.map(buildAbsenceTupleKey))

  const missingInWeekly = Array.from(dashboardKeys).filter(key => !weeklyKeys.has(key))
  const missingInDashboard = Array.from(weeklyKeys).filter(key => !dashboardKeys.has(key))

  return {
    dashboardCount: dashboardKeys.size,
    weeklyCount: weeklyKeys.size,
    missingInWeekly,
    missingInDashboard,
    inSync: missingInWeekly.length === 0 && missingInDashboard.length === 0,
  }
}
