import {
  compareSubCoverageTuples,
  extractDashboardSubCoverageTuples,
  extractWeeklySubCoverageTuples,
} from '@/lib/schedules/sub-coverage-sync'
import {
  baseSubCoverageTuples,
  buildDashboardPayloadFromTuples,
  buildWeeklyPayloadFromTuples,
} from '@/tests/helpers/sub-coverage-sync-fixtures'

describe('Sub Coverage Sync Contract', () => {
  const weekStartISO = '2026-03-16'

  const dashboardPayload = {
    ...buildDashboardPayloadFromTuples(baseSubCoverageTuples),
    scheduled_subs: [
      ...buildDashboardPayloadFromTuples(baseSubCoverageTuples).scheduled_subs,
      ...buildDashboardPayloadFromTuples([baseSubCoverageTuples[0]]).scheduled_subs,
      {
        sub_id: null,
        teacher_id: 'teacher-6',
        date: '2026-03-16',
        time_slot_code: 'LB2',
        classroom_name: 'Infant Room',
      },
    ],
  }

  const weeklyPayload = {
    ...buildWeeklyPayloadFromTuples(),
    classrooms: buildWeeklyPayloadFromTuples().classrooms.map(classroom => ({
      ...classroom,
      days: classroom.days.map(day => ({
        ...day,
        time_slots: day.time_slots.map(slot => ({
          ...slot,
          assignments:
            classroom.classroom_name === 'Infant Room'
              ? [
                  ...slot.assignments,
                  { teacher_id: 'sub-a', absent_teacher_id: 'teacher-1', is_substitute: true },
                  { teacher_id: 'teacher-7', absent_teacher_id: undefined, is_substitute: false },
                ]
              : slot.assignments,
        })),
      })),
    })),
  }

  it('keeps dashboard and weekly sub tuples fully in sync for same window', () => {
    const dashboardTuples = extractDashboardSubCoverageTuples(dashboardPayload)
    const weeklyTuples = extractWeeklySubCoverageTuples(weeklyPayload, { weekStartISO })
    const result = compareSubCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(5)
    expect(result.weeklyCount).toBe(5)
    expect(result.missingInWeekly).toEqual([])
    expect(result.missingInDashboard).toEqual([])
    expect(result.inSync).toBe(true)
  })

  it('detects divergence when weekly drops one substitute tuple (failure-demonstration pattern)', () => {
    const dashboardTuples = extractDashboardSubCoverageTuples(dashboardPayload)
    const weeklyWithoutSubC = JSON.parse(JSON.stringify(weeklyPayload))
    weeklyWithoutSubC.classrooms[0].days[0].time_slots[0].assignments =
      weeklyWithoutSubC.classrooms[0].days[0].time_slots[0].assignments.filter(
        (a: any) => !(a.teacher_id === 'sub-c' && a.absent_teacher_id === 'teacher-3')
      )
    const weeklyTuples = extractWeeklySubCoverageTuples(weeklyWithoutSubC, { weekStartISO })
    const result = compareSubCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.inSync).toBe(false)
    expect(result.dashboardCount).toBe(5)
    expect(result.weeklyCount).toBe(4)
    expect(result.missingInWeekly).toEqual(['sub-c|teacher-3|2026-03-16|lb2|infant room'])
    expect(result.missingInDashboard).toEqual([])
  })

  it('applies school-closure filtering consistently before tuple comparison', () => {
    const closures = [{ date: '2026-03-16', time_slot_code: 'LB2' }]
    const dashboardTuples = extractDashboardSubCoverageTuples(dashboardPayload, { closures })
    const weeklyTuples = extractWeeklySubCoverageTuples(weeklyPayload, { weekStartISO, closures })
    const result = compareSubCoverageTuples(dashboardTuples, weeklyTuples)

    expect(result.dashboardCount).toBe(0)
    expect(result.weeklyCount).toBe(0)
    expect(result.inSync).toBe(true)
  })
})
