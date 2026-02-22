import { render, screen } from '@testing-library/react'
import ScheduleCell from '@/components/schedules/ScheduleCell'

jest.mock('@/components/schedules/AbsentTeacherPopover', () => {
  return function MockAbsentTeacherPopover({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }
})

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const baseData = {
  day_of_week_id: 'day-1',
  day_name: 'Monday',
  day_number: 1,
  time_slot_id: 'slot-1',
  time_slot_code: 'EM',
  time_slot_name: 'Early Morning',
  time_slot_display_order: 1,
  assignments: [],
  schedule_cell: {
    id: 'cell-1',
    is_active: true,
    enrollment_for_staffing: 8,
    notes: null,
    class_groups: [
      {
        id: 'cg-1',
        name: 'Toddler A',
        min_age: 24,
        max_age: 36,
        required_ratio: 8,
        preferred_ratio: 6,
      },
    ],
  },
  absences: [],
  classroom_name: 'Infant Room',
}

const isBefore = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('ScheduleCell', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('renders absent->sub->teacher->flex->floater in order with alphabetical sorting within groups', () => {
    render(
      <ScheduleCell
        data={{
          ...baseData,
          assignments: [
            {
              id: 'teacher-z',
              teacher_id: 'teacher-z',
              teacher_name: 'Zara T.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
            {
              id: 'teacher-a',
              teacher_id: 'teacher-a',
              teacher_name: 'Anna T.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
            {
              id: 'flex-z',
              teacher_id: 'flex-z',
              teacher_name: 'Flex Z.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_flexible: true,
            },
            {
              id: 'flex-a',
              teacher_id: 'flex-a',
              teacher_name: 'Flex A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_flexible: true,
            },
            {
              id: 'floater-z',
              teacher_id: 'floater-z',
              teacher_name: 'Floater Z.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_floater: true,
            },
            {
              id: 'floater-a',
              teacher_id: 'floater-a',
              teacher_name: 'Floater A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_floater: true,
            },
            {
              id: 'sub-1',
              teacher_id: 'sub-1',
              teacher_name: 'Sub B.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_substitute: true,
              absent_teacher_id: 'absent-1',
            },
          ],
          absences: [
            {
              teacher_id: 'absent-1',
              teacher_name: 'Absent A.',
              has_sub: true,
              is_partial: false,
              time_off_request_id: 'tor-1',
            },
          ],
        }}
      />
    )

    const absent = screen.getByText('Absent A.')
    const sub = screen.getByText('Sub B.')
    const teacherA = screen.getByText('Anna T.')
    const teacherZ = screen.getByText('Zara T.')
    const flexA = screen.getByText('Flex A.')
    const flexZ = screen.getByText('Flex Z.')
    const floaterA = screen.getByText('Floater A.')
    const floaterZ = screen.getByText('Floater Z.')

    expect(isBefore(absent, sub)).toBe(true)
    expect(isBefore(sub, teacherA)).toBe(true)
    expect(isBefore(teacherA, teacherZ)).toBe(true)
    expect(isBefore(teacherZ, flexA)).toBe(true)
    expect(isBefore(flexA, flexZ)).toBe(true)
    expect(isBefore(flexZ, floaterA)).toBe(true)
    expect(isBefore(floaterA, floaterZ)).toBe(true)
  })

  it('shows only absences and substitutes in substitutes-only mode', () => {
    render(
      <ScheduleCell
        displayMode="substitutes-only"
        data={{
          ...baseData,
          assignments: [
            {
              id: 'teacher-1',
              teacher_id: 'teacher-1',
              teacher_name: 'Teacher A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
            {
              id: 'sub-1',
              teacher_id: 'sub-1',
              teacher_name: 'Sub A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_substitute: true,
              absent_teacher_id: 'absent-1',
            },
          ],
          absences: [
            {
              teacher_id: 'absent-1',
              teacher_name: 'Absent A.',
              has_sub: true,
              is_partial: false,
              time_off_request_id: 'tor-1',
            },
          ],
        }}
      />
    )

    expect(screen.getByText('Absent A.')).toBeInTheDocument()
    expect(screen.getByText('Sub A.')).toBeInTheDocument()
    expect(screen.queryByText('Teacher A.')).not.toBeInTheDocument()
  })

  it('hides absence/sub chips in permanent-only mode', () => {
    render(
      <ScheduleCell
        displayMode="permanent-only"
        data={{
          ...baseData,
          assignments: [
            {
              id: 'teacher-1',
              teacher_id: 'teacher-1',
              teacher_name: 'Teacher A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
            {
              id: 'sub-1',
              teacher_id: 'sub-1',
              teacher_name: 'Sub A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_substitute: true,
              absent_teacher_id: 'absent-1',
            },
          ],
          absences: [
            {
              teacher_id: 'absent-1',
              teacher_name: 'Absent A.',
              has_sub: true,
              is_partial: false,
              time_off_request_id: 'tor-1',
            },
          ],
        }}
      />
    )

    expect(screen.getByText('Teacher A.')).toBeInTheDocument()
    expect(screen.queryByText('Absent A.')).not.toBeInTheDocument()
    expect(screen.queryByText('Sub A.')).not.toBeInTheDocument()
  })

  it('shows red staffing status when assigned is below required', () => {
    render(
      <ScheduleCell
        data={{
          ...baseData,
          schedule_cell: {
            ...baseData.schedule_cell,
            enrollment_for_staffing: 16, // required = ceil(16 / 8) = 2
          },
          assignments: [
            {
              id: 'teacher-1',
              teacher_id: 'teacher-1',
              teacher_name: 'Teacher A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
          ],
        }}
      />
    )

    expect(screen.getByText(/below required staffing by 1.0/i)).toBeInTheDocument()
  })

  it('shows amber staffing status when below preferred but meeting required', () => {
    render(
      <ScheduleCell
        data={{
          ...baseData,
          schedule_cell: {
            ...baseData.schedule_cell,
            enrollment_for_staffing: 16, // required = 2, preferred = ceil(16 / 6) = 3
          },
          assignments: [
            {
              id: 'teacher-1',
              teacher_id: 'teacher-1',
              teacher_name: 'Teacher A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
            {
              id: 'teacher-2',
              teacher_id: 'teacher-2',
              teacher_name: 'Teacher B.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
          ],
        }}
      />
    )

    expect(screen.getByText(/below preferred staffing by 1.0/i)).toBeInTheDocument()
  })

  it('counts floater assignments fractionally in staffing status', () => {
    render(
      <ScheduleCell
        data={{
          ...baseData,
          schedule_cell: {
            ...baseData.schedule_cell,
            enrollment_for_staffing: 16, // required = 2
          },
          assignments: [
            {
              id: 'teacher-1',
              teacher_id: 'teacher-1',
              teacher_name: 'Teacher A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
            {
              id: 'floater-1',
              teacher_id: 'floater-1',
              teacher_name: 'Floater A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_floater: true,
            },
          ],
        }}
      />
    )

    expect(screen.getByText(/below required staffing by 0.5/i)).toBeInTheDocument()
  })

  it('shows green staffing status when preferred target is met', () => {
    render(
      <ScheduleCell
        data={{
          ...baseData,
          schedule_cell: {
            ...baseData.schedule_cell,
            enrollment_for_staffing: 16, // preferred = 3
          },
          assignments: [
            {
              id: 'teacher-1',
              teacher_id: 'teacher-1',
              teacher_name: 'Teacher A.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
            {
              id: 'teacher-2',
              teacher_id: 'teacher-2',
              teacher_name: 'Teacher B.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
            {
              id: 'teacher-3',
              teacher_id: 'teacher-3',
              teacher_name: 'Teacher C.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
            },
          ],
        }}
      />
    )

    expect(screen.getByText(/meets preferred staffing \(3.0 teachers\)/i)).toBeInTheDocument()
  })
})
