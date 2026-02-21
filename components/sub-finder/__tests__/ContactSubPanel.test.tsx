import { render, screen, waitFor } from '@testing-library/react'
import ContactSubPanel from '@/components/sub-finder/ContactSubPanel'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/hooks/use-sub-assignment-mutations', () => ({
  useAssignSubShifts: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}))

describe('ContactSubPanel', () => {
  beforeEach(() => {
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
})
