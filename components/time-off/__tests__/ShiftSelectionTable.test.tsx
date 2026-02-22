import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShiftSelectionTable from '@/components/time-off/ShiftSelectionTable'

describe('ShiftSelectionTable', () => {
  let consoleErrorSpy: jest.SpyInstance
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const firstArg = args[0]
      if (
        typeof firstArg === 'string' &&
        firstArg.includes('An update to ShiftSelectionTable inside a test was not wrapped in act')
      ) {
        return
      }
    })
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/timeslots') {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 'slot-1', code: 'EM', name: 'Early Morning', display_order: 1 }],
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response
    }) as jest.Mock
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  it('shows placeholder message when teacher and start date are missing', () => {
    render(
      <ShiftSelectionTable
        teacherId={null}
        startDate=""
        endDate=""
        selectedShifts={[]}
        onShiftsChange={jest.fn()}
      />
    )

    expect(
      screen.getByText(/select a teacher and start date to preview scheduled shifts/i)
    ).toBeInTheDocument()
  })

  it('shows empty-state message when there are no scheduled shifts', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/timeslots') {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 'slot-1', code: 'EM', name: 'Early Morning', display_order: 1 }],
        } as Response
      }
      if (url.includes('/api/teachers/teacher-1/scheduled-shifts')) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ shifts: [] }),
      } as Response
    }) as jest.Mock

    render(
      <ShiftSelectionTable
        teacherId="teacher-1"
        startDate="2026-02-10"
        endDate="2026-02-10"
        selectedShifts={[]}
        onShiftsChange={jest.fn()}
      />
    )

    expect(await screen.findByText(/loading shifts/i)).toBeInTheDocument()
    expect(
      await screen.findByText(
        /no scheduled shifts found for this teacher in the selected date range/i
      )
    ).toBeInTheDocument()
  })

  it('toggles a scheduled shift checkbox and calls onShiftsChange', async () => {
    const user = userEvent.setup()
    const onShiftsChange = jest.fn()

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/timeslots') {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 'slot-1', code: 'EM', name: 'Early Morning', display_order: 1 }],
        } as Response
      }
      if (url.includes('/api/teachers/teacher-1/scheduled-shifts')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              date: '2026-02-10',
              day_of_week_id: 'day-1',
              day_name: 'Monday',
              day_number: 1,
              time_slot_id: 'slot-1',
              time_slot_code: 'EM',
              time_slot_name: 'Early Morning',
            },
          ],
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ shifts: [] }),
      } as Response
    }) as jest.Mock

    render(
      <ShiftSelectionTable
        teacherId="teacher-1"
        startDate="2026-02-10"
        endDate="2026-02-10"
        selectedShifts={[]}
        onShiftsChange={onShiftsChange}
      />
    )

    const checkbox = await screen.findByRole('checkbox')
    await user.click(checkbox)

    await waitFor(() =>
      expect(onShiftsChange).toHaveBeenCalledWith([
        {
          date: '2026-02-10',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
        },
      ])
    )
  })

  it('auto-selects scheduled shifts in disabled mode and excludes conflicting shifts', async () => {
    const onShiftsChange = jest.fn()
    const onConflictSummaryChange = jest.fn()
    const onConflictRequestsChange = jest.fn()

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/timeslots') {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'slot-1', code: 'EM', name: 'Early Morning', display_order: 1 },
            { id: 'slot-2', code: 'AM', name: 'Morning', display_order: 2 },
          ],
        } as Response
      }
      if (url.includes('/api/teachers/teacher-1/scheduled-shifts')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              date: '2026-02-10',
              day_of_week_id: 'day-1',
              day_name: 'Monday',
              day_number: 1,
              time_slot_id: 'slot-1',
              time_slot_code: 'EM',
              time_slot_name: 'Early Morning',
            },
            {
              date: '2026-02-10',
              day_of_week_id: 'day-1',
              day_name: 'Monday',
              day_number: 1,
              time_slot_id: 'slot-2',
              time_slot_code: 'AM',
              time_slot_name: 'Morning',
            },
          ],
        } as Response
      }
      if (url.includes('/api/time-off/existing-shifts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            shifts: [
              {
                date: '2026-02-10',
                time_slot_id: 'slot-2',
                time_off_request_id: 'req-1',
                time_off_requests: {
                  id: 'req-1',
                  start_date: '2026-02-10',
                  end_date: '2026-02-10',
                  reason: 'Vacation',
                  teacher_id: 'teacher-1',
                },
              },
            ],
          }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response
    }) as jest.Mock

    render(
      <ShiftSelectionTable
        teacherId="teacher-1"
        startDate="2026-02-10"
        endDate="2026-02-10"
        selectedShifts={[]}
        onShiftsChange={onShiftsChange}
        validateConflicts
        disabled
        onConflictSummaryChange={onConflictSummaryChange}
        onConflictRequestsChange={onConflictRequestsChange}
      />
    )

    await waitFor(() => {
      expect(onShiftsChange).toHaveBeenCalledWith([
        {
          date: '2026-02-10',
          day_of_week_id: 'day-1',
          time_slot_id: 'slot-1',
        },
      ])
    })

    expect(screen.getAllByText(/already/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/recorded/i).length).toBeGreaterThan(0)
    expect(onConflictSummaryChange).toHaveBeenCalledWith({ conflictCount: 1, totalScheduled: 2 })
    expect(onConflictRequestsChange).toHaveBeenCalledWith([
      {
        id: 'req-1',
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        reason: 'Vacation',
      },
    ])
  })

  it('filters conflicting selected shifts from incoming selectedShifts', async () => {
    const onShiftsChange = jest.fn()

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/timeslots') {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 'slot-1', code: 'EM', name: 'Early Morning', display_order: 1 }],
        } as Response
      }
      if (url.includes('/api/teachers/teacher-1/scheduled-shifts')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              date: '2026-02-10',
              day_of_week_id: 'day-1',
              day_name: 'Monday',
              day_number: 1,
              time_slot_id: 'slot-1',
              time_slot_code: 'EM',
              time_slot_name: 'Early Morning',
            },
          ],
        } as Response
      }
      if (url.includes('/api/time-off/existing-shifts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            shifts: [
              {
                date: '2026-02-10',
                time_slot_id: 'slot-1',
                time_off_request_id: 'req-1',
                time_off_requests: {
                  id: 'req-1',
                  start_date: '2026-02-10',
                  end_date: '2026-02-10',
                  reason: 'Sick Day',
                  teacher_id: 'teacher-1',
                },
              },
            ],
          }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response
    }) as jest.Mock

    render(
      <ShiftSelectionTable
        teacherId="teacher-1"
        startDate="2026-02-10"
        endDate="2026-02-10"
        selectedShifts={[
          {
            date: '2026-02-10',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
          },
        ]}
        onShiftsChange={onShiftsChange}
        validateConflicts
      />
    )

    await waitFor(() => {
      expect(onShiftsChange).toHaveBeenCalledWith([])
    })
  })
})
