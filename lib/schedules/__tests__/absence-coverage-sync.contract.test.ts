import {
  compareAbsenceCoverageTuples,
  extractDashboardAbsenceCoverageTuples,
  extractWeeklyAbsenceCoverageTuples,
} from '@/lib/schedules/sub-coverage-sync'
import {
  baseAbsenceCoverageTuples,
  buildDashboardAbsencePayloadFromTuples,
  buildWeeklyAbsencePayloadFromTuples,
} from '@/tests/helpers/sub-coverage-sync-fixtures'

describe('Absence Coverage Sync Contract', () => {
  const weekStartISO = '2026-03-16'

  const dashboardPayload = {
    ...buildDashboardAbsencePayloadFromTuples(baseAbsenceCoverageTuples),
    coverage_requests: [
      ...buildDashboardAbsencePayloadFromTuples(baseAbsenceCoverageTuples).coverage_requests,
      ...buildDashboardAbsencePayloadFromTuples([baseAbsenceCoverageTuples[0]]).coverage_requests,
      {
        id: 'cr-no-teacher',
        teacher_id: null,
        shift_details: [
          {
            date: '2026-03-16',
            time_slot_id: 'slot-lb2',
            classroom_id: 'class-infant',
            status: 'covered',
          },
        ],
      },
      {
        id: 'cr-missing-slot',
        teacher_id: 'teacher-missing-slot',
        shift_details: [
          {
            date: '2026-03-16',
            classroom_id: 'class-infant',
            status: 'covered',
          },
        ],
      },
    ],
  }

  const weeklyPayload = {
    ...buildWeeklyAbsencePayloadFromTuples(baseAbsenceCoverageTuples),
    classrooms: buildWeeklyAbsencePayloadFromTuples(baseAbsenceCoverageTuples).classrooms.map(
      classroom => ({
        ...classroom,
        days: classroom.days.map(day => ({
          ...day,
          time_slots: day.time_slots.map(slot => ({
            ...slot,
            absences:
              classroom.classroom_id === 'class-infant'
                ? [
                    ...slot.absences,
                    {
                      teacher_id: 'teacher-1',
                      has_sub: true,
                    },
                    {
                      teacher_id: null,
                      has_sub: true,
                    },
                  ]
                : slot.absences,
          })),
        })),
      })
    ),
  }

  it('keeps dashboard and weekly absence tuples in sync for same window', () => {
    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardPayload)
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyPayload, { weekStartISO })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(4)
    expect(result.weeklyCount).toBe(4)
    expect(result.missingInWeekly).toEqual([])
    expect(result.missingInDashboard).toEqual([])
    expect(result.inSync).toBe(true)
  })

  it('detects divergence when weekly drops one absence tuple (failure-demonstration pattern)', () => {
    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardPayload)
    const weeklyWithoutTeacher4 = JSON.parse(JSON.stringify(weeklyPayload))
    weeklyWithoutTeacher4.classrooms[1].days[0].time_slots[0].absences =
      weeklyWithoutTeacher4.classrooms[1].days[0].time_slots[0].absences.filter(
        (a: any) => a.teacher_id !== 'teacher-4'
      )
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyWithoutTeacher4, { weekStartISO })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.inSync).toBe(false)
    expect(result.dashboardCount).toBe(4)
    expect(result.weeklyCount).toBe(3)
    expect(result.missingInWeekly).toEqual(['teacher-4|2026-03-16|slot-lb2|class-toddler|0'])
    expect(result.missingInDashboard).toEqual([])
  })

  it('detects divergence when coverage state differs for same absence tuple identity', () => {
    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardPayload)
    const weeklyCoverageMismatch = JSON.parse(JSON.stringify(weeklyPayload))
    weeklyCoverageMismatch.classrooms[0].days[0].time_slots[0].absences =
      weeklyCoverageMismatch.classrooms[0].days[0].time_slots[0].absences.map((a: any) =>
        a.teacher_id === 'teacher-2' ? { ...a, has_sub: true } : a
      )
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyCoverageMismatch, {
      weekStartISO,
    })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.inSync).toBe(false)
    expect(result.missingInWeekly).toEqual(['teacher-2|2026-03-16|slot-lb2|class-infant|0'])
    expect(result.missingInDashboard).toEqual(['teacher-2|2026-03-16|slot-lb2|class-infant|1'])
  })

  it('applies school-closure filtering consistently before comparison', () => {
    const closures = [{ date: '2026-03-16', time_slot_id: 'slot-lb2' }]
    const dashboardTuples = extractDashboardAbsenceCoverageTuples(dashboardPayload, { closures })
    const weeklyTuples = extractWeeklyAbsenceCoverageTuples(weeklyPayload, {
      weekStartISO,
      closures,
    })
    const result = compareAbsenceCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(0)
    expect(result.weeklyCount).toBe(0)
    expect(result.inSync).toBe(true)
  })
})
