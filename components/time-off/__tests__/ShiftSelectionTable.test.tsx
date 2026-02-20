import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShiftSelectionTable from '@/components/time-off/ShiftSelectionTable'

describe('ShiftSelectionTable', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
