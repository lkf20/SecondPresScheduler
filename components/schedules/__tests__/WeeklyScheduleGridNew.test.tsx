import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import WeeklyScheduleGridNew from '@/components/schedules/WeeklyScheduleGridNew'
import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

const setActivePanelMock = jest.fn()
const restorePreviousPanelMock = jest.fn()
const clearPreviousPanelMock = jest.fn()
const registerPanelCloseHandlerMock = jest.fn(() => jest.fn())
let previousPanelMock: { type: 'schedule'; restoreCallback?: () => void } | null = null

beforeEach(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/class-groups')) {
      return { ok: true, json: async () => [] } as Response
    }
    return { ok: false, json: async () => ({}) } as Response
  }) as jest.Mock
})

jest.mock('@/lib/contexts/PanelManagerContext', () => ({
  usePanelManager: () => ({
    setActivePanel: setActivePanelMock,
    previousPanel: previousPanelMock,
    restorePreviousPanel: restorePreviousPanelMock,
    clearPreviousPanel: clearPreviousPanelMock,
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
  const actual = jest.requireActual<typeof import('@/components/schedules/ScheduleSidePanel')>(
    '@/components/schedules/ScheduleSidePanel'
  )
  function MockScheduleSidePanel({
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
  return {
    ...actual,
    __esModule: true,
    default: MockScheduleSidePanel,
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
    previousPanelMock = null
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

  it('scrolls to the requested day header when a scroll request is provided', async () => {
    const { container, rerender } = render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        scrollToDayId="day-mon"
        scrollToDayRequestId={0}
        readOnly
      />
    )

    const dayHeader = container.querySelector('[data-day-header-id="day-mon"]') as HTMLElement
    expect(dayHeader).toBeTruthy()
    const scrollContainer = dayHeader.closest('.overflow-x-auto') as HTMLElement
    expect(scrollContainer).toBeTruthy()

    const scrollToMock = jest.fn()
    ;(scrollContainer as any).scrollTo = scrollToMock
    Object.defineProperty(scrollContainer, 'scrollLeft', { value: 0, writable: true })
    scrollContainer.getBoundingClientRect = jest.fn(() => ({
      left: 100,
      top: 0,
      right: 700,
      bottom: 400,
      width: 600,
      height: 400,
      x: 100,
      y: 0,
      toJSON: () => '',
    })) as any
    dayHeader.getBoundingClientRect = jest.fn(() => ({
      left: 380,
      top: 0,
      right: 500,
      bottom: 36,
      width: 120,
      height: 36,
      x: 380,
      y: 0,
      toJSON: () => '',
    })) as any

    rerender(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        scrollToDayId="day-mon"
        scrollToDayRequestId={1}
        readOnly
      />
    )

    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledWith(
        expect.objectContaining({
          behavior: 'smooth',
        })
      )
    })
  })

  it('does nothing when the requested day header is not rendered', async () => {
    const { container, rerender } = render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        scrollToDayId="day-fri"
        scrollToDayRequestId={0}
        readOnly
      />
    )

    const dayHeader = container.querySelector('[data-day-header-id="day-mon"]') as HTMLElement
    const scrollContainer = dayHeader.closest('.overflow-x-auto') as HTMLElement
    const scrollToMock = jest.fn()
    ;(scrollContainer as any).scrollTo = scrollToMock

    rerender(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        scrollToDayId="day-fri"
        scrollToDayRequestId={1}
        readOnly
      />
    )

    await waitFor(() => {
      expect(scrollToMock).not.toHaveBeenCalled()
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

  it('hides Temporary Coverage from legend when showLegendTemporaryCoverage is false (Baseline)', () => {
    render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        showLegendSubstitutes={false}
        showLegendTemporaryCoverage={false}
        readOnly
      />
    )

    expect(screen.getByText('Key:')).toBeInTheDocument()
    expect(screen.getByText('Flex Teacher')).toBeInTheDocument()
    expect(screen.getByText('Floater')).toBeInTheDocument()
    expect(screen.queryByText('Temporary Coverage')).not.toBeInTheDocument()
    expect(screen.queryByText('Substitute')).not.toBeInTheDocument()
  })

  it('shows Temporary Coverage in legend when showLegendTemporaryCoverage is true (Weekly)', () => {
    render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        showLegendSubstitutes
        showLegendTemporaryCoverage
        readOnly
      />
    )

    expect(screen.getByText('Temporary Coverage')).toBeInTheDocument()
  })

  it('shows Reassigned legend item when reassigned markers exist in the week', () => {
    const dataWithReassignment: WeeklyScheduleDataByClassroom[] = [
      {
        ...scheduleData[0],
        days: [
          {
            ...scheduleData[0].days[0],
            time_slots: [
              {
                ...scheduleData[0].days[0].time_slots[0],
                absences: [
                  {
                    teacher_id: 'teacher-1',
                    teacher_name: 'Jenn S.',
                    has_sub: true,
                    is_partial: false,
                    is_reassigned: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]

    render(
      <WeeklyScheduleGridNew
        data={dataWithReassignment}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        showLegendSubstitutes
        readOnly
      />
    )

    expect(screen.getByText('Reassigned *')).toBeInTheDocument()
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

  it('does not immediately reopen after manual close when stale restore state exists', async () => {
    const { rerender } = render(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        readOnly
      />
    )

    fireEvent.click(screen.getByText('Bella W.'))
    await screen.findByText('Panel: Infant Room')

    // Simulate previous close-request flow that stored a cell in savedCellRef.
    const closeHandler = registerPanelCloseHandlerMock.mock.calls[0]?.[1] as
      | (() => void)
      | undefined
    expect(closeHandler).toBeDefined()
    closeHandler?.()

    await waitFor(() => {
      expect(screen.queryByText('Panel: Infant Room')).not.toBeInTheDocument()
    })

    // Reopen panel normally.
    fireEvent.click(screen.getByText('Bella W.'))
    await screen.findByText('Panel: Infant Room')

    // Inject stale previous-panel state and rerender to simulate intermittent real-world state.
    previousPanelMock = { type: 'schedule', restoreCallback: jest.fn() }
    rerender(
      <WeeklyScheduleGridNew
        data={scheduleData}
        selectedDayIds={['day-mon']}
        layout="days-x-classrooms"
        readOnly
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close Panel' }))

    await waitFor(() => {
      expect(screen.queryByText('Panel: Infant Room')).not.toBeInTheDocument()
    })
    expect(clearPreviousPanelMock).toHaveBeenCalled()
  })
})
