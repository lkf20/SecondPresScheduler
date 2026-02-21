import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import WeeklyScheduleGridNew from '@/components/schedules/WeeklyScheduleGridNew'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

const setActivePanelMock = jest.fn()
const restorePreviousPanelMock = jest.fn()
const registerPanelCloseHandlerMock = jest.fn(() => jest.fn())

jest.mock('@/lib/contexts/PanelManagerContext', () => ({
  usePanelManager: () => ({
    setActivePanel: setActivePanelMock,
    previousPanel: null,
    restorePreviousPanel: restorePreviousPanelMock,
    registerPanelCloseHandler: registerPanelCloseHandlerMock,
  }),
}))

jest.mock('@/components/schedules/ScheduleCell', () => {
  return function MockScheduleCell({
    data,
  }: {
    data?: { assignments?: Array<{ teacher_name?: string | null }> }
  }) {
    const teacherName = data?.assignments?.[0]?.teacher_name || 'Empty Cell'
    return <div>{teacherName}</div>
  }
})

jest.mock('@/components/schedules/ScheduleSidePanel', () => {
  return function MockScheduleSidePanel({
    dayName,
    timeSlotCode,
    classroomName,
    onClose,
    onSave,
  }: {
    dayName: string
    timeSlotCode: string
    classroomName: string
    onClose: () => void
    onSave?: () => void | Promise<void>
  }) {
    return (
      <div>
        <div>Panel: {classroomName}</div>
        <div>
          Slot: {dayName} {timeSlotCode}
        </div>
        <button onClick={onClose}>Close Panel</button>
        <button
          onClick={() => {
            void onSave?.()
          }}
        >
          Save Panel
        </button>
      </div>
    )
  }
})

const scheduleData: WeeklyScheduleDataByClassroom[] = [
  {
    classroom_id: 'class-1',
    classroom_name: 'Infant Room',
    classroom_color: '#88bbee',
    days: [
      {
        day_of_week_id: 'day-mon',
        day_name: 'Monday',
        day_number: 1,
        time_slots: [
          {
            time_slot_id: 'slot-em',
            time_slot_code: 'EM',
            time_slot_name: 'Early Morning',
            time_slot_display_order: 1,
            time_slot_start_time: '08:00',
            time_slot_end_time: '10:00',
            assignments: [
              {
                id: 'a-1',
                teacher_id: 'teacher-1',
                teacher_name: 'Bella W.',
                classroom_id: 'class-1',
                classroom_name: 'Infant Room',
              },
            ],
            absences: [],
            schedule_cell: {
              id: 'cell-1',
              is_active: true,
              enrollment_for_staffing: 8,
              notes: null,
              class_groups: [
                {
                  id: 'cg-1',
                  name: 'Infant A',
                  min_age: 1,
                  max_age: 2,
                  required_ratio: 4,
                  preferred_ratio: 3,
                },
              ],
            },
          },
        ],
      },
    ],
  },
]

describe('WeeklyScheduleGridNew interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('requests filter panel close when a cell is clicked while filters are open', () => {
    const onFilterPanelOpenChange = jest.fn()

    render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        filterPanelOpen
        onFilterPanelOpenChange={onFilterPanelOpenChange}
        readOnly
      />
    )

    fireEvent.click(screen.getByText('Bella W.'))

    expect(onFilterPanelOpenChange).toHaveBeenCalledWith(false)
  })

  it('applies initialSelectedCell and opens panel without a click', async () => {
    render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        initialSelectedCell={{
          classroomId: 'class-1',
          dayId: 'day-mon',
          timeSlotId: 'slot-em',
        }}
        readOnly
      />
    )

    expect(await screen.findByText('Panel: Infant Room')).toBeInTheDocument()
    expect(screen.getByText('Slot: Monday EM')).toBeInTheDocument()
  })

  it('calls onRefresh when panel save is triggered', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined)

    render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        onRefresh={onRefresh}
        readOnly
      />
    )

    fireEvent.click(screen.getByText('Bella W.'))
    fireEvent.click(await screen.findByRole('button', { name: 'Save Panel' }))

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1)
    })
  })

  it('emits display mode changes from filter chips', () => {
    const onDisplayModeChange = jest.fn()

    render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        onDisplayModeChange={onDisplayModeChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /coverage issues/i }))

    expect(onDisplayModeChange).toHaveBeenCalledWith('coverage-issues')
  })

  it('opens panel from classrooms-x-days layout cell clicks', async () => {
    render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="classrooms-x-days"
        readOnly
      />
    )

    fireEvent.click(screen.getByText('Bella W.'))

    expect(await screen.findByText('Panel: Infant Room')).toBeInTheDocument()
    expect(screen.getByText('Slot: Monday EM')).toBeInTheDocument()
  })

  it('registers panel manager lifecycle on open and close', async () => {
    render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        readOnly
      />
    )

    fireEvent.click(screen.getByText('Bella W.'))
    await screen.findByText('Panel: Infant Room')

    expect(setActivePanelMock).toHaveBeenCalledWith('schedule', expect.any(Function))
    expect(registerPanelCloseHandlerMock).toHaveBeenCalledWith('schedule', expect.any(Function))

    fireEvent.click(screen.getByRole('button', { name: 'Close Panel' }))

    await waitFor(() => {
      expect(setActivePanelMock).toHaveBeenCalledWith(null)
    })
  })
})
