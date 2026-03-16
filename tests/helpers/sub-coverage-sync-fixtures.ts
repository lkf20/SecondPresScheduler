export type SubCoverageFixtureTuple = {
  sub_id: string
  teacher_id: string
  date: string
  time_slot_code: string
  classroom_name: string
}

export type AbsenceCoverageFixtureTuple = {
  teacher_id: string
  date: string
  day_number: number
  time_slot_id: string
  time_slot_code: string
  classroom_id: string
  classroom_name: string
  has_sub: boolean
}

export const baseSubCoverageTuples: SubCoverageFixtureTuple[] = [
  {
    sub_id: 'sub-a',
    teacher_id: 'teacher-1',
    date: '2026-03-16',
    time_slot_code: 'LB2',
    classroom_name: 'Infant Room',
  },
  {
    sub_id: 'sub-b',
    teacher_id: 'teacher-2',
    date: '2026-03-16',
    time_slot_code: 'LB2',
    classroom_name: 'Infant Room',
  },
  {
    sub_id: 'sub-c',
    teacher_id: 'teacher-3',
    date: '2026-03-16',
    time_slot_code: 'LB2',
    classroom_name: 'Infant Room',
  },
  {
    sub_id: 'floater-1',
    teacher_id: 'teacher-4',
    date: '2026-03-16',
    time_slot_code: 'LB2',
    classroom_name: 'Infant Room',
  },
  {
    sub_id: 'floater-1',
    teacher_id: 'teacher-5',
    date: '2026-03-16',
    time_slot_code: 'LB2',
    classroom_name: 'Toddler Room',
  },
]

export const buildDashboardPayloadFromTuples = (tuples: SubCoverageFixtureTuple[]) => ({
  scheduled_subs: tuples.map((tuple, idx) => ({
    id: `sa-${idx + 1}`,
    sub_id: tuple.sub_id,
    teacher_id: tuple.teacher_id,
    date: tuple.date,
    time_slot_code: tuple.time_slot_code,
    classroom_name: tuple.classroom_name,
  })),
})

export const buildWeeklyPayloadFromTuples = () => ({
  classrooms: [
    {
      classroom_name: 'Infant Room',
      days: [
        {
          day_number: 1,
          time_slots: [
            {
              time_slot_id: 'slot-lb2',
              time_slot_code: 'LB2',
              assignments: [
                { teacher_id: 'sub-a', absent_teacher_id: 'teacher-1', is_substitute: true },
                { teacher_id: 'sub-b', absent_teacher_id: 'teacher-2', is_substitute: true },
                { teacher_id: 'sub-c', absent_teacher_id: 'teacher-3', is_substitute: true },
                { teacher_id: 'floater-1', absent_teacher_id: 'teacher-4', is_substitute: true },
              ],
            },
          ],
        },
      ],
    },
    {
      classroom_name: 'Toddler Room',
      days: [
        {
          day_number: 1,
          time_slots: [
            {
              time_slot_id: 'slot-lb2',
              time_slot_code: 'LB2',
              assignments: [
                { teacher_id: 'floater-1', absent_teacher_id: 'teacher-5', is_substitute: true },
              ],
            },
          ],
        },
      ],
    },
  ],
})

export const baseAbsenceCoverageTuples: AbsenceCoverageFixtureTuple[] = [
  {
    teacher_id: 'teacher-1',
    date: '2026-03-16',
    day_number: 1,
    time_slot_id: 'slot-lb2',
    time_slot_code: 'LB2',
    classroom_id: 'class-infant',
    classroom_name: 'Infant Room',
    has_sub: true,
  },
  {
    teacher_id: 'teacher-2',
    date: '2026-03-16',
    day_number: 1,
    time_slot_id: 'slot-lb2',
    time_slot_code: 'LB2',
    classroom_id: 'class-infant',
    classroom_name: 'Infant Room',
    has_sub: false,
  },
  {
    teacher_id: 'teacher-3',
    date: '2026-03-16',
    day_number: 1,
    time_slot_id: 'slot-lb2',
    time_slot_code: 'LB2',
    classroom_id: 'class-toddler',
    classroom_name: 'Toddler Room',
    has_sub: true,
  },
  {
    teacher_id: 'teacher-4',
    date: '2026-03-16',
    day_number: 1,
    time_slot_id: 'slot-lb2',
    time_slot_code: 'LB2',
    classroom_id: 'class-toddler',
    classroom_name: 'Toddler Room',
    has_sub: false,
  },
]

export const buildDashboardAbsencePayloadFromTuples = (tuples: AbsenceCoverageFixtureTuple[]) => ({
  coverage_requests: tuples.map((tuple, idx) => ({
    id: `cr-${idx + 1}`,
    teacher_id: tuple.teacher_id,
    shift_details: [
      {
        date: tuple.date,
        time_slot_id: tuple.time_slot_id,
        time_slot_code: tuple.time_slot_code,
        classroom_id: tuple.classroom_id,
        classroom_name: tuple.classroom_name,
        status: tuple.has_sub ? 'covered' : 'uncovered',
      },
    ],
  })),
})

export const buildWeeklyAbsencePayloadFromTuples = (tuples: AbsenceCoverageFixtureTuple[]) => {
  const classroomMap = new Map<
    string,
    { classroom_id: string; classroom_name: string; days: Map<number, any> }
  >()

  for (const tuple of tuples) {
    if (!classroomMap.has(tuple.classroom_id)) {
      classroomMap.set(tuple.classroom_id, {
        classroom_id: tuple.classroom_id,
        classroom_name: tuple.classroom_name,
        days: new Map<number, any>(),
      })
    }
    const classroom = classroomMap.get(tuple.classroom_id)!
    if (!classroom.days.has(tuple.day_number)) {
      classroom.days.set(tuple.day_number, {
        day_number: tuple.day_number,
        time_slots: new Map<string, any>(),
      })
    }
    const day = classroom.days.get(tuple.day_number)!
    if (!day.time_slots.has(tuple.time_slot_id)) {
      day.time_slots.set(tuple.time_slot_id, {
        time_slot_id: tuple.time_slot_id,
        time_slot_code: tuple.time_slot_code,
        absences: [],
      })
    }
    const slot = day.time_slots.get(tuple.time_slot_id)!
    slot.absences.push({
      teacher_id: tuple.teacher_id,
      has_sub: tuple.has_sub,
    })
  }

  return {
    classrooms: Array.from(classroomMap.values()).map(classroom => ({
      classroom_id: classroom.classroom_id,
      classroom_name: classroom.classroom_name,
      days: Array.from(classroom.days.values()).map(day => ({
        day_number: day.day_number,
        time_slots: Array.from(day.time_slots.values()),
      })),
    })),
  }
}
