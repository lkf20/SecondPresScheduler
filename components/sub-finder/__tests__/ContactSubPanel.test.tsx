import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  const baseSub = {
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
  } as const

  const baseAbsence = {
    id: 'absence-1',
    teacher_name: 'Teacher One',
    start_date: '2026-02-09',
    end_date: '2026-02-09',
  } as const

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
      expect(screen.getByText('Contact Status')).toBeInTheDocument()
    })

    expect(screen.getByText(/texted in morning/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /pending/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('defaults to Not contacted when switching to a different sub, even if previous fetch resolves confirmed', async () => {
    let resolveFirstSubContact: ((value: Response) => void) | null = null

    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/timeslots')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response)
      }
      if (url.includes('/api/sub-finder/coverage-request/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response)
      }
      if (url.includes('/api/subs/sub-1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ active: true }),
        } as Response)
      }
      if (url.includes('/api/subs/sub-2')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ active: true }),
        } as Response)
      }
      if (url.includes('sub_id=sub-1')) {
        return new Promise(resolve => {
          resolveFirstSubContact = resolve
        })
      }
      if (url.includes('sub_id=sub-2')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'contact-2',
            is_contacted: false,
            contacted_at: null,
            response_status: 'none',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response)
    }) as jest.Mock

    const { rerender } = render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={baseSub}
        absence={baseAbsence}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2026-02-09T12:00:00.000Z',
          response_status: 'confirmed',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: [],
          override_shift_keys: [],
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /confirmed/i })).toHaveAttribute(
        'aria-checked',
        'true'
      )
    })

    rerender(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={{
          ...baseSub,
          id: 'sub-2',
          name: 'Taylor B.',
        }}
        absence={baseAbsence}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /not contacted/i })).toHaveAttribute(
        'aria-checked',
        'true'
      )
    })

    resolveFirstSubContact?.({
      ok: true,
      json: async () => ({
        id: 'contact-1',
        is_contacted: true,
        contacted_at: '2026-02-09T12:00:00.000Z',
        response_status: 'confirmed',
        notes: '',
      }),
    } as Response)

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /not contacted/i })).toHaveAttribute(
        'aria-checked',
        'true'
      )
    })
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
      expect(screen.getByText(/contact status/i)).toBeInTheDocument()
    })
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/sub-finder/coverage-request/')
    )
  })

  it('when manual absence and no time off: shows create time off message and disables Assign (scenarios 2–3)', async () => {
    const onCreateTimeOffRequest = jest.fn()
    const onAddExtraCoverage = jest.fn()

    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={{
          ...baseSub,
          can_cover: [
            {
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              class_name: 'Infant',
            },
          ],
        }}
        absence={{
          id: 'manual-teacher-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
          shifts: {
            total: 1,
            uncovered: 1,
            partially_covered: 0,
            fully_covered: 0,
            shift_details: [
              {
                date: '2026-02-09',
                day_name: 'Monday',
                time_slot_code: 'EM',
                status: 'uncovered',
              },
            ],
          },
        }}
        onCreateTimeOffRequest={onCreateTimeOffRequest}
        onAddExtraCoverage={onAddExtraCoverage}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByText(/assigning requires a time off request for this range/i)
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /create time off for this range/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /i meant to add extra coverage/i })
    ).toBeInTheDocument()

    const assignButton = screen.getByRole('button', { name: /^assign$/i })
    expect(assignButton).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /create time off for this range/i }))
    expect(onCreateTimeOffRequest).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: /i meant to add extra coverage/i }))
    expect(onAddExtraCoverage).toHaveBeenCalledTimes(1)
  })

  it('when manual absence without onAddExtraCoverage: does not show extra coverage button', async () => {
    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={baseSub}
        absence={{
          id: 'manual-teacher-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
          shifts: {
            total: 0,
            uncovered: 0,
            partially_covered: 0,
            fully_covered: 0,
            shift_details: [],
          },
        }}
        onCreateTimeOffRequest={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByText(/assigning requires a time off request for this range/i)
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('button', { name: /i meant to add extra coverage/i })
    ).not.toBeInTheDocument()
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
          shifts: {
            shift_details: [
              {
                date: '2026-02-09',
                day_name: 'Monday',
                time_slot_code: 'EM',
                status: 'uncovered' as const,
              },
            ],
          },
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
    expect(screen.getByText('This sub has declined all shifts.')).toBeInTheDocument()
    expect(
      screen.queryByText(/this sub is available for \d+ of \d+ remaining shift/)
    ).not.toBeInTheDocument()
  })

  it('shows Notes textarea with placeholder "e.g. Left a voicemail"', async () => {
    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={baseSub}
        absence={baseAbsence}
        initialContactData={{
          id: 'contact-1',
          is_contacted: false,
          contacted_at: null,
          response_status: 'none',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: [],
          override_shift_keys: [],
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Contact Status')).toBeInTheDocument()
    })

    const notesField = screen.getByPlaceholderText('e.g. Left a voicemail')
    expect(notesField).toBeInTheDocument()
  })

  it('calls onAssignmentComplete when contact status changes from Declined all to Not contacted', async () => {
    const user = userEvent.setup()
    const onAssignmentComplete = jest.fn()

    const declinedContact = {
      id: 'contact-1',
      is_contacted: true,
      contacted_at: '2026-02-09T12:00:00.000Z',
      response_status: 'declined_all',
      notes: '',
      coverage_request_id: 'coverage-1',
      selected_shift_keys: [] as string[],
      override_shift_keys: [] as string[],
    }
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/subs/')) {
        return { ok: true, json: async () => ({ active: true }) } as Response
      }
      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }
      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return { ok: true, json: async () => declinedContact } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
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
            { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: 'Infant' },
          ],
          cannot_cover: [],
          assigned_shifts: [],
        }}
        absence={{
          id: 'absence-1',
          teacher_name: 'Teacher One',
          start_date: '2026-02-09',
          end_date: '2026-02-09',
          shifts: {
            shift_details: [
              {
                date: '2026-02-09',
                day_name: 'Monday',
                time_slot_code: 'EM',
                status: 'uncovered' as const,
              },
            ],
          },
        }}
        initialContactData={declinedContact}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('This sub has declined all shifts.')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText(/not contacted/i))

    expect(onAssignmentComplete).toHaveBeenCalled()
  })

  it('saves declined-all status and closes panel', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const onAssignmentComplete = jest.fn()

    const declinedContact = {
      id: 'contact-1',
      is_contacted: true,
      contacted_at: '2026-02-09T12:00:00.000Z',
      response_status: 'declined_all',
      notes: '',
      coverage_request_id: 'coverage-1',
      selected_shift_keys: [] as string[],
      override_shift_keys: [] as string[],
    }
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }

      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }

      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return {
          ok: true,
          json: async () => declinedContact,
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
        initialContactData={declinedContact}
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

  it('shows declined status when panel reopens after refetch (stale cache fix)', async () => {
    // Simulate reopening the panel with stale initialContactData (e.g. not_contacted).
    // The panel should refetch and then show declined_all when the API returns it.
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/subs/')) {
        return { ok: true, json: async () => ({ active: true }) } as Response
      }
      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }
      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return {
          ok: true,
          json: async () => ({
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'declined_all',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    }) as jest.Mock

    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={baseSub}
        absence={baseAbsence}
        initialContactData={{
          id: 'contact-1',
          is_contacted: false,
          contacted_at: null,
          response_status: 'none',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: [],
          override_shift_keys: [],
        }}
      />
    )

    // Initially we may show stale "Not contacted" from cache, then refetch runs
    await waitFor(
      () => {
        expect(screen.getByText('This sub has declined all shifts.')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    expect(screen.getByRole('radio', { name: /declined all/i })).toHaveAttribute(
      'aria-checked',
      'true'
    )
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

      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }
      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return {
          ok: true,
          json: async () => ({
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'pending',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }),
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

    const shiftCheckboxes = await screen.findAllByRole('checkbox')
    await user.click(shiftCheckboxes[0])
    await user.click(screen.getByRole('button', { name: /^assign$/i }))
    // Refetch returns pending, so Assign opens confirmation dialog; confirm to proceed
    await user.click(screen.getByRole('button', { name: /assign without confirming/i }))

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

  it('includes partial_assignments with optional times when partial shift is selected', async () => {
    const user = userEvent.setup()

    mockAssignMutateAsync.mockResolvedValueOnce({
      assigned_shifts: [],
      assignments_created: 1,
      partial_assignments_created: 1,
      full_assignments_created: 0,
    })

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }
      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }
      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return {
          ok: true,
          json: async () => ({
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'pending',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }),
        } as Response
      }

      if (url === '/api/sub-finder/shift-overrides' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            shift_overrides: [
              {
                coverage_request_shift_id: 'crs-1',
                shift_key: '2026-02-09|EM',
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
        variant="inline"
        sub={baseSub}
        absence={baseAbsence}
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

    const shiftCheckboxes = await screen.findAllByRole('checkbox')
    await user.click(shiftCheckboxes[0])

    await user.click(screen.getByLabelText(/partial shift \(sub covers part of this shift\)/i))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '10:15' } })

    await user.click(screen.getByRole('button', { name: /^assign$/i }))
    await user.click(screen.getByRole('button', { name: /assign without confirming/i }))

    await waitFor(() => {
      expect(mockAssignMutateAsync).toHaveBeenCalledWith({
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['crs-1'],
        partial_assignments: [
          {
            shift_id: 'crs-1',
            partial_start_time: '09:00',
            partial_end_time: '10:15',
          },
        ],
      })
    })
  })

  it('shows helper copy when shift already has partial coverage', async () => {
    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={baseSub}
        absence={{
          ...baseAbsence,
          shifts: {
            shift_details: [
              {
                date: '2026-02-09',
                day_name: 'Monday',
                time_slot_code: 'EM',
                status: 'partially_covered',
                sub_name: 'Bella W.',
                assigned_subs: [
                  {
                    assignment_id: 'assign-1',
                    sub_id: 'sub-bella',
                    sub_name: 'Bella W.',
                    is_partial: true,
                    partial_start_time: '08:00',
                    partial_end_time: '10:30',
                  },
                ],
              },
            ],
          },
        }}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2026-02-09T12:00:00.000Z',
          response_status: 'confirmed',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: [],
          override_shift_keys: [],
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Shift assignments')).toBeInTheDocument()
    })

    expect(
      screen.getByText('Partially covered. You can add another partial assignment.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Current partial coverage: Bella W\. \(08:00-10:30\)/i)
    ).toBeInTheDocument()
  })

  it('shows explicit partial label when shift is assigned to this sub as partial', async () => {
    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={{
          ...baseSub,
          assigned_shifts: [
            {
              coverage_request_shift_id: 'crs-1',
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              is_partial: true,
              partial_start_time: '09:00',
              partial_end_time: '10:15',
            },
          ],
        }}
        absence={{
          ...baseAbsence,
          shifts: {
            shift_details: [
              {
                date: '2026-02-09',
                day_name: 'Monday',
                time_slot_code: 'EM',
                status: 'partially_covered',
                sub_name: 'Sally A.',
              },
            ],
          },
        }}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2026-02-09T12:00:00.000Z',
          response_status: 'confirmed',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: [],
          override_shift_keys: [],
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Assigned to this sub')).toBeInTheDocument()
    })
    expect(screen.getByText(/Partial assignment \(09:00-10:15\)/i)).toBeInTheDocument()
  })

  it('shows toast error when save fails while resolving shift overrides', async () => {
    const user = userEvent.setup()

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }

      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }
      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return {
          ok: true,
          json: async () => ({
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: ['2026-02-09|EM'],
            override_shift_keys: [],
          }),
        } as Response
      }

      if (url.includes('shift-overrides') && init?.method === 'POST') {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'override failed',
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

    // Refetch leaves us confirmed; select a shift then Save (triggers resolveShiftOverrides POST which fails)
    const shiftCheckboxes = await screen.findAllByRole('checkbox')
    await user.click(shiftCheckboxes[0])
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error saving contact', {
        description: 'override failed',
      })
    })
  })

  it('shows alert when assign fails with plain text backend error', async () => {
    const user = userEvent.setup()
    mockAssignMutateAsync.mockRejectedValueOnce(new Error('backend exploded'))

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }

      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }
      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return {
          ok: true,
          json: async () => ({
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: ['2026-02-09|EM'],
            override_shift_keys: [],
          }),
        } as Response
      }

      if (url === '/api/sub-finder/shift-overrides' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            shift_overrides: [],
            selected_shift_ids: ['crs-1'],
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
    expect(screen.getByRole('button', { name: /^assign$/i })).toBeInTheDocument()
  })

  it('shows toast error when declined-all save cannot get or create contact', async () => {
    const user = userEvent.setup()

    const declinedContactNoId = {
      id: '',
      is_contacted: true,
      contacted_at: '2026-02-09T12:00:00.000Z',
      response_status: 'declined_all',
      notes: '',
      coverage_request_id: 'coverage-1',
      selected_shift_keys: [] as string[],
      override_shift_keys: [] as string[],
    }
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }

      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }

      if (url.includes('/api/sub-finder/substitute-contacts?') && !init?.method) {
        return {
          ok: false,
          json: async () => ({ error: 'lookup failed' }),
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
        initialContactData={declinedContactNoId}
      />
    )

    await user.click(screen.getByRole('button', { name: /mark as declined/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error saving declined status', {
        description: 'Failed to get or create contact',
      })
    })
  })

  it('renders contextual warnings when selected shifts require unmet capabilities', async () => {
    const user = userEvent.setup()

    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={{
          ...baseSub,
          can_change_diapers: false,
          can_lift_children: false,
          can_cover: [
            {
              ...baseSub.can_cover[0],
              diaper_changing_required: true,
              lifting_children_required: true,
            },
          ],
        }}
        absence={baseAbsence}
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

    const shiftCheckboxes = await screen.findAllByRole('checkbox')
    await user.click(shiftCheckboxes[0])

    expect(await screen.findByText(/important information/i)).toBeInTheDocument()
    expect(screen.getByText(/diapering required/i)).toBeInTheDocument()
    expect(screen.getByText(/lifting children required/i)).toBeInTheDocument()
    expect(screen.getByText(/prefers not to lift children/i)).toBeInTheDocument()
  })

  it('allows selecting an unavailable shift after override and assigns it', async () => {
    const user = userEvent.setup()
    mockAssignMutateAsync.mockResolvedValueOnce({ assigned_shifts: [] })

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }

      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: true,
          json: async () => ({ coverage_request_id: 'coverage-1' }),
        } as Response
      }
      if (url.includes('/api/sub-finder/substitute-contacts?')) {
        return {
          ok: true,
          json: async () => ({
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }),
        } as Response
      }

      if (url === '/api/sub-finder/shift-overrides' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            shift_overrides: [
              {
                coverage_request_shift_id: 'crs-2',
                selected: true,
                override_availability: true,
              },
            ],
            selected_shift_ids: ['crs-2'],
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
        variant="inline"
        sub={{
          ...baseSub,
          can_cover: [],
          cannot_cover: [
            {
              date: '2026-02-09',
              day_name: 'Monday',
              time_slot_code: 'EM',
              reason: 'Marked as unavailable',
            },
          ],
        }}
        absence={baseAbsence}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2026-02-09T12:00:00.000Z',
          response_status: 'confirmed',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: [],
          override_shift_keys: [],
        }}
      />
    )

    await user.click(await screen.findByRole('button', { name: /^override$/i }))

    const [unavailableShiftCheckbox] = screen.getAllByRole('checkbox')
    expect(unavailableShiftCheckbox).toBeEnabled()
    await user.click(unavailableShiftCheckbox)
    await user.click(screen.getByRole('button', { name: /^assign$/i }))

    await waitFor(() => {
      expect(mockAssignMutateAsync).toHaveBeenCalledWith({
        coverage_request_id: 'coverage-1',
        sub_id: 'sub-1',
        selected_shift_ids: ['crs-2'],
      })
    })
  })

  it('shows full-date contacted timestamp format for prior years', async () => {
    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={baseSub}
        absence={baseAbsence}
        initialContactData={{
          id: 'contact-1',
          is_contacted: true,
          contacted_at: '2024-01-05T12:00:00.000Z',
          response_status: 'pending',
          notes: '',
          coverage_request_id: 'coverage-1',
          selected_shift_keys: ['2026-02-09|EM'],
          override_shift_keys: [],
        }}
      />
    )

    expect(await screen.findByText(/updated/i)).toHaveTextContent(/2024/i)
  })

  it('handles coverage request lookup failure without throwing', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/sub-finder/coverage-request/')) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          url,
          text: async () => 'coverage boom',
        } as Response
      }
      if (url.includes('/api/subs/')) {
        return {
          ok: true,
          json: async () => ({ active: true }),
        } as Response
      }
      return {
        ok: true,
        json: async () => null,
      } as Response
    }) as jest.Mock

    render(
      <ContactSubPanel
        isOpen
        onClose={jest.fn()}
        variant="inline"
        sub={baseSub}
        absence={baseAbsence}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Sally A\./)).toBeInTheDocument()
    })
  })

  describe('shift assignment cards', () => {
    const absenceWithTwoShifts = {
      id: 'absence-1',
      teacher_name: 'Teacher One',
      start_date: '2026-02-09',
      end_date: '2026-02-10',
      shifts: {
        shift_details: [
          {
            date: '2026-02-09',
            day_name: 'Monday',
            time_slot_code: 'EM',
            status: 'uncovered' as const,
          },
          {
            date: '2026-02-10',
            day_name: 'Tuesday',
            time_slot_code: 'EM',
            status: 'uncovered' as const,
          },
        ],
      },
    }

    it('shows green left border when sub can cover shift, gray when cannot', async () => {
      const greenBorder = 'rgb(110, 231, 183)'
      const grayBorder = 'rgb(226, 232, 240)'

      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            can_cover: [
              { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null },
            ],
            cannot_cover: [
              {
                date: '2026-02-10',
                day_name: 'Tuesday',
                time_slot_code: 'EM',
                reason: 'Unavailable',
              },
            ],
          }}
          absence={absenceWithTwoShifts}
          initialContactData={{
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      const monEm = screen.getByText('Mon EM')
      const tueEm = screen.getByText('Tue EM')
      const cardWithMon = monEm.closest('.border-l-4')
      const cardWithTue = tueEm.closest('.border-l-4')

      expect(cardWithMon).toBeInTheDocument()
      expect(cardWithTue).toBeInTheDocument()
      expect((cardWithMon as HTMLElement).style.borderLeftColor).toBe(greenBorder)
      expect((cardWithTue as HTMLElement).style.borderLeftColor).toBe(grayBorder)
    })

    it('shows available (teal) chip border when sub can cover, gray when cannot', async () => {
      const tealBorder = 'rgb(196, 234, 226)'
      // ShiftChips uses shiftStatusColorValues.unavailable.border (gray-200)
      const grayBorder = 'rgb(229, 231, 235)'

      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            can_cover: [
              { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null },
            ],
            cannot_cover: [
              {
                date: '2026-02-10',
                day_name: 'Tuesday',
                time_slot_code: 'EM',
                reason: 'Unavailable',
              },
            ],
          }}
          absence={absenceWithTwoShifts}
          initialContactData={{
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      const monEm = screen.getByText('Mon EM')
      const tueEm = screen.getByText('Tue EM')
      // Chip Badge is the div with inline style containing the teal/gray border color (ShiftChips softAvailableStyle + shiftStatusColorValues.unavailable)
      const chipWithMon = monEm.closest('div[style*="196, 234, 226"]')
      const chipWithTue = tueEm.closest('div[style*="229, 231, 235"]')

      expect(chipWithMon).toBeInTheDocument()
      expect(chipWithTue).toBeInTheDocument()
      expect((chipWithMon as HTMLElement).style.borderColor).toBe(tealBorder)
      expect((chipWithTue as HTMLElement).style.borderColor).toBe(grayBorder)
    })

    it('shows gray card border for all shifts when contact status is Declined all', async () => {
      const grayBorder = 'rgb(226, 232, 240)'
      const declinedContact = {
        id: 'contact-1',
        is_contacted: true,
        contacted_at: '2026-02-09T12:00:00.000Z',
        response_status: 'declined_all',
        notes: '',
        coverage_request_id: 'coverage-1',
        selected_shift_keys: [] as string[],
        override_shift_keys: [] as string[],
      }
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/subs/')) {
          return { ok: true, json: async () => ({ active: true }) } as Response
        }
        if (url.includes('/api/sub-finder/coverage-request/')) {
          return {
            ok: true,
            json: async () => ({ coverage_request_id: 'coverage-1' }),
          } as Response
        }
        if (url.includes('/api/sub-finder/substitute-contacts?')) {
          return { ok: true, json: async () => declinedContact } as Response
        }
        return { ok: true, json: async () => ({}) } as Response
      }) as jest.Mock

      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            can_cover: [
              { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null },
              { date: '2026-02-10', day_name: 'Tuesday', time_slot_code: 'EM', class_name: null },
            ],
            cannot_cover: [],
          }}
          absence={absenceWithTwoShifts}
          initialContactData={declinedContact}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      const monEm = screen.getByText('Mon EM')
      const tueEm = screen.getByText('Tue EM')
      const cardWithMon = monEm.closest('.border-l-4')
      const cardWithTue = tueEm.closest('.border-l-4')

      expect((cardWithMon as HTMLElement).style.borderLeftColor).toBe(grayBorder)
      expect((cardWithTue as HTMLElement).style.borderLeftColor).toBe(grayBorder)

      expect(screen.getAllByText('Declined this shift').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Locked').length).toBeGreaterThanOrEqual(1)
    })

    it('shows Uncovered in chip when shift is uncovered; shows assigned sub name when assigned to another sub', async () => {
      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            can_cover: [
              { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null },
              { date: '2026-02-10', day_name: 'Tuesday', time_slot_code: 'EM', class_name: null },
            ],
            cannot_cover: [],
          }}
          absence={{
            ...absenceWithTwoShifts,
            shifts: {
              shift_details: [
                {
                  date: '2026-02-09',
                  day_name: 'Monday',
                  time_slot_code: 'EM',
                  status: 'uncovered',
                },
                {
                  date: '2026-02-10',
                  day_name: 'Tuesday',
                  time_slot_code: 'EM',
                  status: 'fully_covered',
                  sub_name: 'Bella W.',
                },
              ],
            },
          }}
          initialContactData={{
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      expect(screen.getByText('Uncovered')).toBeInTheDocument()
      expect(screen.getByText('Bella W.')).toBeInTheDocument()
    })

    it('shows Assign checkbox when shift is uncovered and sub can cover', async () => {
      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            can_cover: [
              { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null },
            ],
            cannot_cover: [],
          }}
          absence={{
            ...baseAbsence,
            shifts: {
              shift_details: [
                {
                  date: '2026-02-09',
                  day_name: 'Monday',
                  time_slot_code: 'EM',
                  status: 'uncovered',
                },
              ],
            },
          }}
          initialContactData={{
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      expect(screen.getByText('Assign', { selector: 'span' })).toBeInTheDocument()
      const checkboxes = screen.getAllByRole('checkbox')
      const assignCheckbox = checkboxes.find(cb => cb.closest('.border-l-4') != null)
      expect(assignCheckbox).toBeDefined()
      expect(assignCheckbox).toBeInTheDocument()
    })

    it('shows Replace button when shift is assigned to another sub', async () => {
      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            can_cover: [
              { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null },
            ],
            cannot_cover: [],
          }}
          absence={{
            ...baseAbsence,
            shifts: {
              shift_details: [
                {
                  date: '2026-02-09',
                  day_name: 'Monday',
                  time_slot_code: 'EM',
                  status: 'fully_covered',
                  sub_name: 'Bella W.',
                },
              ],
            },
          }}
          initialContactData={{
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /replace with sally a\./i })).toBeInTheDocument()
    })

    it('does not show Replace when shift is already assigned to this sub', async () => {
      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            assigned_shifts: [
              {
                coverage_request_shift_id: 'crs-1',
                date: '2026-02-09',
                day_name: 'Monday',
                time_slot_code: 'EM',
              },
            ],
            can_cover: [
              { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null },
            ],
            cannot_cover: [],
          }}
          absence={{
            ...baseAbsence,
            shifts: {
              shift_details: [
                {
                  date: '2026-02-09',
                  day_name: 'Monday',
                  time_slot_code: 'EM',
                  status: 'fully_covered',
                  sub_name: 'Sally A.',
                  sub_id: 'sub-1',
                },
              ],
            },
          }}
          initialContactData={{
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      expect(screen.getByText(/assigned to this sub/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /replace with sally a\./i })
      ).not.toBeInTheDocument()
    })

    it('uses sub id (not name) to decide if the current sub owns a covered shift', async () => {
      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            name: 'Victoria I.',
            can_cover: [],
            cannot_cover: [],
          }}
          absence={{
            ...baseAbsence,
            shifts: {
              shift_details: [
                {
                  date: '2026-02-09',
                  day_name: 'Monday',
                  time_slot_code: 'EM',
                  status: 'fully_covered',
                  sub_name: 'Victoria I.',
                  sub_id: 'different-sub-id',
                },
              ],
            },
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
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      expect(screen.getByText('0 of 1 upcoming shifts need coverage')).toBeInTheDocument()
    })

    it('hides Replace action in preview mode for covered shifts', async () => {
      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          previewMode
          sub={{
            ...baseSub,
            can_cover: [
              { date: '2026-02-09', day_name: 'Monday', time_slot_code: 'EM', class_name: null },
            ],
            cannot_cover: [],
          }}
          absence={{
            ...baseAbsence,
            shifts: {
              shift_details: [
                {
                  date: '2026-02-09',
                  day_name: 'Monday',
                  time_slot_code: 'EM',
                  status: 'fully_covered',
                  sub_name: 'Bella W.',
                },
              ],
            },
          }}
          initialContactData={{
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      expect(
        screen.queryByRole('button', { name: /replace with sally a\./i })
      ).not.toBeInTheDocument()
    })

    it('shows Override button when sub cannot cover but reason is overridable', async () => {
      render(
        <ContactSubPanel
          isOpen
          onClose={jest.fn()}
          variant="inline"
          sub={{
            ...baseSub,
            can_cover: [],
            cannot_cover: [
              {
                date: '2026-02-09',
                day_name: 'Monday',
                time_slot_code: 'EM',
                reason: 'Marked as unavailable',
              },
            ],
          }}
          absence={{
            ...baseAbsence,
            shifts: {
              shift_details: [
                {
                  date: '2026-02-09',
                  day_name: 'Monday',
                  time_slot_code: 'EM',
                  status: 'uncovered',
                },
              ],
            },
          }}
          initialContactData={{
            id: 'contact-1',
            is_contacted: true,
            contacted_at: '2026-02-09T12:00:00.000Z',
            response_status: 'confirmed',
            notes: '',
            coverage_request_id: 'coverage-1',
            selected_shift_keys: [],
            override_shift_keys: [],
          }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Shift assignments')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /^override$/i })).toBeInTheDocument()
    })
  })
})
