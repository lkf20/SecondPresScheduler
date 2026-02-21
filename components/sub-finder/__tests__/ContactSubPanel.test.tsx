import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactSubPanel from '@/components/sub-finder/ContactSubPanel'

const mockRefresh = jest.fn()
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()
const mockAssignMutateAsync = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

jest.mock('@/lib/hooks/use-sub-assignment-mutations', () => ({
  useAssignSubShifts: () => ({
    mutateAsync: (...args: unknown[]) => mockAssignMutateAsync(...args),
    isPending: false,
  }),
}))

describe('ContactSubPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active: true }),
    } as Response)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders empty-state panel when open without a selected sub', () => {
    render(
      <ContactSubPanel isOpen onClose={jest.fn()} sub={null} absence={null} variant="inline" />
    )

    expect(screen.getByText('Contact Sub')).toBeInTheDocument()
    expect(screen.getByText(/no sub selected/i)).toBeInTheDocument()
  })

  it('uses initial contact data to render contacted state without waiting for API hydration', async () => {
    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={{
          id: 'sub-1',
          name: 'Sally A.',
          phone: '555-111-2222',
          email: 'sally@example.com',
          coverage_percent: 100,
          shifts_covered: 1,
          total_shifts: 1,
          can_cover: [
            {
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              class_name: 'Infant',
            },
          ],
          cannot_cover: [],
          assigned_shifts: [],
        }}
        absence={{
          id: 'absence-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
        }}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2026-02-09T12:00:00.000Z',
          response_status: 'pending',
          notes: 'Texted in morning',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: ['2026-02-09|EM'],
          override_shift_keys: [],
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Contact Summary')).toBeInTheDocument()
    })

    expect(screen.getByText(/texted in morning/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /contacted/i })).toBeChecked()
  })

  it('returns null when closed and no sub is selected', () => {
    const { container } = render(
      <ContactSubPanel
        isOpen={false}
        onClose={jest.fn()}
        sub={null}
        absence={null}
        variant="inline"
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows inactive warning when sub lookup returns inactive', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: false }),
        } as Response
      }

      if (url.includes('/api/sub-finder/substitute-contacts')) {
        return {
          ok: true,
          json: async () => null,
        } as Response
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response
    }) as jest.Mock

    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={{
          id: 'sub-1',
          name: 'Sally A.',
          phone: '555-111-2222',
          email: 'sally@example.com',
          coverage_percent: 100,
          shifts_covered: 1,
          total_shifts: 1,
          can_cover: [
            {
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              class_name: 'Infant',
            },
          ],
          cannot_cover: [],
          assigned_shifts: [],
        }}
        absence={{
          id: 'absence-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
        }}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByText(/this sub is inactive\. assignment is disabled\./i)
      ).toBeInTheDocument()
    })
  })

  it('skips coverage fetch for manual absences', async () => {
    global.fetch = jest.fn() as jest.Mock

    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={{
          id: 'sub-1',
          name: 'Sally A.',
          phone: '555-111-2222',
          email: 'sally@example.com',
          coverage_percent: 100,
          shifts_covered: 1,
          total_shifts: 1,
          can_cover: [
            {
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              class_name: 'Infant',
            },
          ],
          cannot_cover: [],
          assigned_shifts: [],
        }}
        absence={{
          id: 'manual-absence-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/contact summary/i)).toBeInTheDocument()
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows declining-all state from cached contact data', async () => {
    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={{
          id: 'sub-1',
          name: 'Sally A.',
          phone: '555-111-2222',
          email: 'sally@example.com',
          coverage_percent: 100,
          shifts_covered: 1,
          total_shifts: 1,
          can_cover: [
            {
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              class_name: 'Infant',
            },
          ],
          cannot_cover: [],
          assigned_shifts: [],
        }}
        absence={{
          id: 'absence-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
        }}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2026-02-09T12:00:00.000Z',
          response_status: 'declined_all',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: [],
          override_shift_keys: [],
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/declining all shifts/i)).toBeInTheDocument()
    })
  })

  it('saves declined-all status and closes panel', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const onAssignmentComplete = jest.fn()

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }

      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return {
          ok: true,
          json: async () => ({ id: 'contact-1' }),
        } as Response
      }

      if (url === '/api/sub-finder/substitute-contacts' && init?.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'declined_all',
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    }) as jest.Mock

    render(
      <ContactSubPanel
        isOpen
        onClose={onClose}
        onAssignmentComplete={onAssignmentComplete}
        variant="inline"
        sub={{
          id: 'sub-1',
          name: 'Sally A.',
          phone: '555-111-2222',
          email: 'sally@example.com',
          coverage_percent: 100,
          shifts_covered: 1,
          total_shifts: 1,
          can_cover: [
            {
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              class_name: 'Infant',
            },
          ],
          cannot_cover: [],
          assigned_shifts: [],
        }}
        absence={{
          id: 'absence-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
        }}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2026-02-09T12:00:00.000Z',
          response_status: 'declined_all',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: [],
          override_shift_keys: [],
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: /mark as declined/i }))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Marked as Declined', expect.any(Object))
      expect(onAssignmentComplete).toHaveBeenCalled()
      expect(mockRefresh).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('assigns selected shifts when confirmed', async () => {
    const user = userEvent.setup()
    const onAssignmentComplete = jest.fn()

    mockAssignMutateAsync.mockResolvedValueOnce({
      assigned_shifts: [
        { coverage_request_shift_id: 'crs-1', date: '2026-02-09', time_slot_code: 'EM' },
      ],
    })

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }

      if (url === '/api/sub-finder/shift-overrides' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            shift_overrides: [
              {
                coverage_request_shift_id: 'crs-1',
                selected: true,
                override_availability: false,
              },
            ],
            selected_shift_ids: ['crs-1'],
          }),
        } as Response
      }

      if (url === '/api/sub-finder/substitute-contacts' && init?.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({ id: 'contact-1' }),
        } as Response
      }

      if (url.includes('/assigned-shifts')) {
        return {
          ok: true,
          json: async () => ({
            remaining_shift_keys: [],
            remaining_shift_count: 0,
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    }) as jest.Mock

    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        onAssignmentComplete={onAssignmentComplete}
        variant="inline"
        sub={{
          id: 'sub-1',
          name: 'Sally A.',
          phone: '555-111-2222',
          email: 'sally@example.com',
          coverage_percent: 100,
          shifts_covered: 1,
          total_shifts: 1,
          can_cover: [
            {
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              class_name: 'Infant',
            },
          ],
          cannot_cover: [],
          assigned_shifts: [],
        }}
        absence={{
          id: 'absence-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
        }}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2026-02-09T12:00:00.000Z',
          response_status: 'confirmed',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: ['2026-02-09|EM'],
          override_shift_keys: [],
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: /^assign$/i }))

    await waitFor(() => {
      expect(mockAssignMutateAsync).toHaveBeenCalledWith({
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['crs-1'],
      })
      expect(onAssignmentComplete).toHaveBeenCalled()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })
})
