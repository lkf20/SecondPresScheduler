import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AssignSubPanel from '@/components/assign-sub/AssignSubPanel'
import { useDisplayNameFormat } from '@/lib/hooks/use-display-name-format'

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const mockRefresh = jest.fn()
const mockPush = jest.fn()
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()
const mockToastInfo = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}))

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
}))

jest.mock('@/lib/hooks/use-display-name-format', () => ({
  useDisplayNameFormat: () => ({ format: 'first_name_last_initial' }),
}))

jest.mock('@/lib/utils/colors', () => ({
  getPanelBackgroundClasses: () => 'bg-white',
  adminRoleColorValues: {
    bg: 'rgb(220, 252, 231)',
    border: 'rgb(134, 239, 172)',
    text: 'rgb(21, 128, 61)',
  },
  coverageColorValues: {
    partial: {
      bg: 'rgb(254, 252, 232)',
      border: 'rgb(253, 224, 71)',
      text: 'rgb(202, 138, 4)',
      icon: 'rgb(202, 138, 4)',
    },
  },
}))

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/shared/SearchableSelect', () => {
  return function MockSearchableSelect({ options, value, onValueChange, placeholder }: any) {
    return (
      <div data-testid={`select-${placeholder}`}>
        {value ? (
          <button data-testid={`clear-${placeholder}`} onClick={() => onValueChange(null)}>
            Clear
          </button>
        ) : null}
        {options.map((opt: any) => (
          <button
            key={opt.id}
            data-testid={`option-${placeholder}-${opt.id}`}
            onClick={() => onValueChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }
})

jest.mock('@/components/ui/date-picker-input', () => {
  return function MockDatePickerInput({ value, onChange, placeholder }: any) {
    return (
      <input
        type="text"
        data-testid={`date-${placeholder}`}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    )
  }
})

describe('AssignSubPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock global fetch
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()

      if (urlStr.includes('/api/teachers') && !urlStr.includes('/scheduled-shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'teacher-1', first_name: 'Sally', last_name: 'A.', active: true },
            ]),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/subs') && !urlStr.includes('/qualifications')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([{ id: 'sub-1', first_name: 'Anne', last_name: 'M.', active: true }]),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/subs/sub-1/qualifications')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/teachers/teacher-1/scheduled-shifts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/timeslots')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'slot-1', code: 'AM', display_order: 1 },
              { id: 'slot-2', code: 'PM', display_order: 2 },
            ]),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: '2026-03-10|dow-2|slot-1',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-1',
                  has_time_off: false,
                  time_off_request_id: null,
                },
                {
                  id: '2026-03-10|dow-2|slot-2',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-2',
                  time_slot_code: 'PM',
                  classroom_id: 'class-1',
                  has_time_off: true,
                  time_off_request_id: 'tor-existing',
                },
              ],
            }),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/classrooms/class-1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Preschool' }),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                shift_key: '2026-03-10|slot-1',
                status: 'unavailable',
                message: 'Marked unavailable',
              },
              {
                shift_key: '2026-03-10|slot-2',
                status: 'conflict_sub',
                message: 'Conflict: Assigned to sub for Sally A. in Preschool',
              },
            ]),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/time-off') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({ id: 'tor-1', start_date: '2026-03-10', end_date: '2026-03-10' }),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/sub-finder/coverage-request/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              coverage_request_id: 'cr-1',
              shift_map: {
                '2026-03-10|AM|class-1': 'crs-1',
                '2026-03-10|AM': 'crs-1',
                '2026-03-10|PM|class-1': 'crs-2',
                '2026-03-10|PM': 'crs-2',
              },
            }),
        }) as Promise<Response>
      }

      if (
        urlStr.includes('/api/sub-finder/substitute-contacts?coverage_request_id=cr-1&sub_id=sub-1')
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'contact-1' }),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/sub-finder/substitute-contacts') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }) as Promise<Response>
      }

      if (urlStr.includes('/api/sub-finder/assign-shifts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ assignments_created: 1, assigned_shifts: [{}] }),
        }) as Promise<Response>
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }) as Promise<Response>
    })
  })

  const fillForm = async (user: any) => {
    // Select Teacher
    await waitFor(() => {
      expect(
        screen.getByTestId('option-Search or select a teacher...-teacher-1')
      ).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('option-Search or select a teacher...-teacher-1'))

    // Select Sub
    await waitFor(() => {
      expect(
        screen.getByTestId('option-Search or select a substitute...-sub-1')
      ).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('option-Search or select a substitute...-sub-1'))

    // Select Start Date
    const startDateInput = await screen.findByTestId('date-Select start date')
    fireEvent.change(startDateInput, { target: { value: '2026-03-10' } })
  }

  it('supports non-sub override assignment and skips substitute-contact writes', async () => {
    const user = userEvent.setup()
    const baseFetch = global.fetch as jest.Mock
    global.fetch = jest.fn(
      async (url: string | URL | globalThis.Request, options?: RequestInit) => {
        const urlStr = url.toString()
        if (urlStr.includes('/api/subs?include_non_sub=true&active_only=true')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 'sub-1', first_name: 'Anne', last_name: 'M.', active: true, is_sub: true },
                {
                  id: 'admin-1',
                  first_name: 'Dana',
                  last_name: 'Director',
                  active: true,
                  is_sub: false,
                },
              ]),
          }) as Promise<Response>
        }
        if (urlStr.includes('/api/sub-finder/check-conflicts')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { shift_key: '2026-03-10|slot-1', status: 'available' },
                { shift_key: '2026-03-10|slot-2', status: 'available' },
              ]),
          }) as Promise<Response>
        }
        return baseFetch(url, options)
      }
    ) as jest.Mock

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)

    await waitFor(() => {
      expect(
        screen.getByTestId('option-Search or select a teacher...-teacher-1')
      ).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('option-Search or select a teacher...-teacher-1'))

    const overrideCheckbox = screen.getByLabelText(/Include non-sub staff/i)
    await user.click(overrideCheckbox)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/subs?include_non_sub=true&active_only=true')
    })

    await user.click(
      screen.getByTestId('option-Search or select staff to cover this shift...-admin-1')
    )
    const startDateInput = await screen.findByTestId('date-Select start date')
    fireEvent.change(startDateInput, { target: { value: '2026-03-10' } })

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })
    await user.click(screen.getByRole('checkbox', { name: /Tue Mar 10 • AM • Preschool/i }))
    await user.click(screen.getByRole('button', { name: /Create Time Off & Assign Sub/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sub-finder/assign-shifts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"allow_non_sub_override":true'),
        })
      )
    })

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/sub-finder/substitute-contacts'),
      expect.anything()
    )
  })

  it('shows Sub Finder helper under staff picker and navigates with teacher/date context', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={onClose} />)

    expect(screen.getByText(/Need help finding a sub/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByTestId('option-Search or select a teacher...-teacher-1')
      ).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('option-Search or select a teacher...-teacher-1'))

    const startDateInput = await screen.findByTestId('date-Select start date')
    fireEvent.change(startDateInput, { target: { value: '2026-03-10' } })

    await user.click(screen.getByRole('button', { name: /Go to Sub Finder/i }))

    expect(mockPush).toHaveBeenCalledWith(
      '/sub-finder?teacher_id=teacher-1&start_date=2026-03-10&end_date=2026-03-10&mode=manual'
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('navigates to Sub Finder with teacher only when no date is selected', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(
        screen.getByTestId('option-Search or select a teacher...-teacher-1')
      ).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('option-Search or select a teacher...-teacher-1'))

    await user.click(screen.getByRole('button', { name: /Go to Sub Finder/i }))

    expect(mockPush).toHaveBeenCalledWith('/sub-finder?teacher_id=teacher-1')
    expect(onClose).toHaveBeenCalled()
  })

  it('navigates to empty Sub Finder when no teacher/date are prefilled', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /Go to Sub Finder/i }))

    expect(mockPush).toHaveBeenCalledWith('/sub-finder')
    expect(onClose).toHaveBeenCalled()
  })

  it('clears selected non-sub assignee when override toggle is turned off', async () => {
    const user = userEvent.setup()
    const baseFetch = global.fetch as jest.Mock
    global.fetch = jest.fn(
      async (url: string | URL | globalThis.Request, options?: RequestInit) => {
        const urlStr = url.toString()
        if (urlStr.includes('/api/subs?include_non_sub=true&active_only=true')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'admin-1',
                  first_name: 'Dana',
                  last_name: 'Director',
                  active: true,
                  is_sub: false,
                },
              ]),
          }) as Promise<Response>
        }
        return baseFetch(url, options)
      }
    ) as jest.Mock

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    const overrideCheckbox = await screen.findByLabelText(/Include non-sub staff/i)
    await user.click(overrideCheckbox)
    await user.click(
      screen.getByTestId('option-Search or select staff to cover this shift...-admin-1')
    )
    await user.click(overrideCheckbox)

    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith(
        expect.stringContaining('Cleared non-sub selection')
      )
    })
  })

  it('shows override enabled chip only when include non-sub is on', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)

    const overrideCheckbox = await screen.findByLabelText(/Include non-sub staff/i)
    expect(screen.queryByText('Override enabled')).not.toBeInTheDocument()

    await user.click(overrideCheckbox)
    expect(screen.getByText('Override enabled')).toBeInTheDocument()
    expect(
      screen.getByText(/Director override enabled\. Non-sub staff can be selected\./i)
    ).toBeInTheDocument()

    await user.click(overrideCheckbox)
    expect(screen.queryByText('Override enabled')).not.toBeInTheDocument()
  })

  it('Single date with no time off: shifts populate (no "No scheduled shifts found")', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)

    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
      expect(screen.getByText(/Tue Mar 10 • PM • Preschool/i)).toBeInTheDocument()
    })

    expect(
      screen.queryByText(/No scheduled shifts found for this teacher in the selected date range/i)
    ).not.toBeInTheDocument()
  })

  it('clears shifts when start date is cleared', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })

    const startDateInput = screen.getByTestId('date-Select start date')
    fireEvent.change(startDateInput, { target: { value: '' } })

    await waitFor(() => {
      expect(screen.queryByText(/Tue Mar 10 • AM • Preschool/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Tue Mar 10 • PM • Preschool/i)).not.toBeInTheDocument()
    })
  })

  it('clears shifts when teacher is cleared', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('clear-Search or select a teacher...'))

    await waitFor(() => {
      expect(screen.queryByText(/Tue Mar 10 • AM • Preschool/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Tue Mar 10 • PM • Preschool/i)).not.toBeInTheDocument()
    })
  })

  it('clears shifts when staff to assign is cleared', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('clear-Search or select a substitute...'))

    await waitFor(() => {
      expect(screen.queryByText(/Tue Mar 10 • AM • Preschool/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Tue Mar 10 • PM • Preschool/i)).not.toBeInTheDocument()
    })
  })

  it('clears shifts when end date is cleared after previously being set', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })

    const endDateInput = screen.getByTestId('date-Select end date')
    fireEvent.change(endDateInput, { target: { value: '2026-03-11' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assign-sub/shifts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"end_date":"2026-03-11"'),
        })
      )
    })

    fireEvent.change(endDateInput, { target: { value: '' } })

    await waitFor(() => {
      expect(screen.queryByText(/Tue Mar 10 • AM • Preschool/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Tue Mar 10 • PM • Preschool/i)).not.toBeInTheDocument()
    })
  })

  it('Shifts without time off show time-off-will-be-created message, never extra coverage', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)

    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })

    expect(
      screen.getByText(
        /No absence recorded yet — a time off request will be created when you assign/i
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/extra coverage/i)).not.toBeInTheDocument()
  })

  it('Scenario 1 & 2: User selects dates with no time off. Shifts populate. User can create time off but cannot create extra coverage.', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    // Override check-conflicts: AM shift must be 'available' so the assign flow proceeds without
    // the "Assign unavailable sub?" dialog (which would block the success toast).
    const baseFetch = global.fetch as jest.Mock
    global.fetch = jest.fn(
      async (url: string | URL | globalThis.Request, options?: RequestInit) => {
        const urlStr = url.toString()
        if (urlStr.includes('/api/sub-finder/check-conflicts')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { shift_key: '2026-03-10|slot-1', status: 'available' },
                {
                  shift_key: '2026-03-10|slot-2',
                  status: 'conflict_sub',
                  message: 'Conflict: Assigned to sub for Sally A. in Preschool',
                },
              ]),
          }) as Promise<Response>
        }
        return baseFetch(url, options)
      }
    ) as jest.Mock
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={onClose} />)

    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })

    // Initially form should not be visible
    expect(screen.queryByText(/Create Time Off Request/i)).not.toBeInTheDocument()

    // Click AM shift (no time off) by label so order doesn't matter
    const amCheckbox = screen.getByRole('checkbox', {
      name: /Tue Mar 10 • AM • Preschool/i,
    })
    await user.click(amCheckbox)

    // Should see time-off form and count message (card uses "shift" when total is 1)
    expect(await screen.findByText(/Create Time Off Request/i)).toBeInTheDocument()
    expect(
      await screen.findByText(/1 of 1 selected shift does not have a time off request/i)
    ).toBeInTheDocument()

    // The button explicitly forces Time Off creation, preventing "extra coverage"
    const assignBtn = screen.getByRole('button', { name: /Create Time Off & Assign Sub/i })
    expect(assignBtn).toBeInTheDocument()

    // Fill notes (reason defaults to Sick Day)
    const timeOffNotesInput = await screen.findByLabelText(/Notes \(optional\)/i)
    await user.type(timeOffNotesInput, 'Sick day requested')
    const subNotesInput = screen.getByLabelText(/^Notes$/i)
    await user.type(subNotesInput, 'Anne agreed to cover')

    // Click Assign (AM shift is 'available' per check-conflicts mock, so no dialog)
    await user.click(assignBtn)

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Time off request created')
      )
    })

    // Verify Time off was created (prevents extra coverage)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/time-off',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Sick day requested'),
      })
    )
  })

  it('resolves coverage shift ids using time_slot_id mapping keys in Assign Sub flow', async () => {
    const user = userEvent.setup()
    const baseFetch = global.fetch as jest.Mock
    global.fetch = jest.fn(
      async (url: string | URL | globalThis.Request, options?: RequestInit) => {
        const urlStr = url.toString()
        if (urlStr.includes('/api/sub-finder/check-conflicts')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { shift_key: '2026-03-10|slot-1', status: 'available' },
                { shift_key: '2026-03-10|slot-2', status: 'available' },
              ]),
          }) as Promise<Response>
        }
        if (urlStr.includes('/api/sub-finder/coverage-request/')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                coverage_request_id: 'cr-1',
                shift_map: {
                  '2026-03-10|slot-1|class-1': 'crs-slot-id-1',
                  '2026-03-10|slot-1': 'crs-slot-id-1',
                  '2026-03-10|slot-2|class-1': 'crs-slot-id-2',
                  '2026-03-10|slot-2': 'crs-slot-id-2',
                },
              }),
          }) as Promise<Response>
        }
        return baseFetch(url, options)
      }
    ) as jest.Mock

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('checkbox', { name: /Tue Mar 10 • AM • Preschool/i }))
    await user.click(screen.getByRole('button', { name: /Create Time Off & Assign Sub/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sub-finder/assign-shifts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"selected_shift_ids":["crs-slot-id-1"]'),
        })
      )
    })
  })

  it('Scenario 3: User selects a shift where the sub is already assigned elsewhere. User should NOT be able to assign that shift.', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)

    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • PM • Preschool/i)).toBeInTheDocument()
    })

    // Wait for conflict badges to appear (conflict_sub message includes classroom)
    await waitFor(() => {
      expect(screen.getByText(/Conflict:.*Preschool/i)).toBeInTheDocument()
    })

    // PM shift has conflict_sub and must be disabled (find by label; order may vary)
    const pmCheckbox = screen.getByRole('checkbox', {
      name: /Tue Mar 10 • PM • Preschool/i,
    })
    expect(pmCheckbox).toBeDisabled()
  })

  it('Scenario 4: User selects shift where the sub is marked as Unavailable. User should be able to assign but there should be a warning.', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)

    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM • Preschool/i)).toBeInTheDocument()
    })

    // Wait for unavailable badge to appear
    await waitFor(() => {
      expect(screen.getByText(/Marked unavailable/i)).toBeInTheDocument()
    })

    // AM shift is unavailable, but should NOT be disabled
    const amShiftCheckbox = screen.getByRole('checkbox', {
      name: /Tue Mar 10 • AM • Preschool/i,
    })
    expect(amShiftCheckbox).not.toBeDisabled()

    // User can select the unavailable (AM) shift
    const amCheckbox = screen.getByRole('checkbox', {
      name: /Tue Mar 10 • AM • Preschool/i,
    })
    await user.click(amCheckbox)
    await waitFor(() => expect(amCheckbox).toBeChecked())

    // Summary should show override warning or manual-override hint (conflictCount or per-shift hint)
    await waitFor(() => {
      expect(
        screen.getByText(/selected shift.*override.*availability or existing assignment/i)
      ).toBeInTheDocument()
    })
  })

  it('Shows capability badges with check or X when a sub is selected', async () => {
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/subs') && !urlStr.includes('/qualifications')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'sub-1',
                first_name: 'Anne',
                last_name: 'M.',
                active: true,
                can_change_diapers: true,
                can_lift_children: false,
                can_assist_with_toileting: true,
              },
            ]),
        }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as typeof fetch
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)
    await waitFor(() => {
      expect(screen.getByText(/Can change diapers/i)).toBeInTheDocument()
      expect(screen.getByText(/Can lift children/i)).toBeInTheDocument()
      expect(screen.getByText(/Can assist with toileting/i)).toBeInTheDocument()
    })
  })

  it('Shows certification as gray badge only (no duplicate "Not qualified for") when teacher has no classes', async () => {
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/subs/sub-1/qualifications')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'q1', qualification: { name: 'CPR certified' } }]),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/teachers/teacher-1/scheduled-shifts')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as typeof fetch
    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)
    await waitFor(() => {
      expect(screen.getByText(/CPR certified/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/Not qualified for CPR certified/i)).not.toBeInTheDocument()
  })

  it('Scenario 5: User selects a shift where sub is marked as unqualified / wrong preferences. User should be able to assign but there should be a warning.', async () => {
    // Override the global fetch for this specific test to return unqualified setup
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/teachers') && !urlStr.includes('/scheduled-shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'teacher-1', first_name: 'Sally', last_name: 'A.', active: true },
            ]),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/subs') && !urlStr.includes('/qualifications')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([{ id: 'sub-1', first_name: 'Anne', last_name: 'M.', active: true }]),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/subs/sub-1/qualifications')) {
        // Sub is ONLY qualified for Infants
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'q1', qualification: { name: 'Infants' } }]),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/teachers/teacher-1/scheduled-shifts')) {
        // Teacher teaches Preschool
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ class_name: 'Preschool' }]),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: '2026-03-10|dow-2|slot-1',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-1',
                  has_time_off: false,
                  time_off_request_id: null,
                },
              ],
            }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/classrooms/class-1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Preschool' }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as Promise<Response>
      }
      if (urlStr.includes('/api/timeslots')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'slot-1', code: 'AM', display_order: 1 }]),
        }) as Promise<Response>
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as Promise<Response>
    })

    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)

    await fillForm(user)

    // Wait for unqualified warning badge to appear below the Sub select (amber only, no duplicate gray badge)
    await waitFor(() => {
      expect(screen.getByText(/Not qualified for Infants/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/^Infants$/)).not.toBeInTheDocument()

    // Shifts should load and be selectable
    await waitFor(() => {
      expect(screen.getByText(/Tue Mar 10 • AM/i)).toBeInTheDocument()
    })

    const amShiftCheckbox = screen.getByRole('checkbox', {
      name: /Tue Mar 10 • AM/i,
    })
    expect(amShiftCheckbox).not.toBeDisabled()

    // User can select it and assign despite being unqualified
    await user.click(amShiftCheckbox)
    expect(amShiftCheckbox).toBeChecked()
  })

  it('shows School closed badge and disables checkbox for shifts on closed days', async () => {
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: '2026-03-10|dow-2|slot-1',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-1',
                  has_time_off: false,
                  time_off_request_id: null,
                  school_closure: true,
                },
                {
                  id: '2026-03-10|dow-2|slot-2',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-2',
                  time_slot_code: 'PM',
                  classroom_id: 'class-1',
                  has_time_off: false,
                  time_off_request_id: null,
                  school_closure: false,
                },
              ],
            }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as any

    const user = userEvent.setup()
    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/School closed/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Tue Mar 10 • AM/i)).toBeInTheDocument()
    expect(screen.getByText(/Tue Mar 10 • PM/i)).toBeInTheDocument()

    const closedShiftCheckbox = screen.getByRole('checkbox', {
      name: /Tue Mar 10 • AM/i,
    })
    const openShiftCheckbox = screen.getByRole('checkbox', {
      name: /Tue Mar 10 • PM/i,
    })
    expect(closedShiftCheckbox).toBeDisabled()
    expect(openShiftCheckbox).not.toBeDisabled()
  })

  it('shows explicit partial assignee label and keeps partial-only shifts assignable', async () => {
    const user = userEvent.setup()
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: '2026-03-10|dow-2|slot-1',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-1',
                  has_time_off: true,
                  time_off_request_id: 'tor-existing',
                  assignment_id: 'assign-partial-1',
                  assigned_sub_id: 'sub-victoria',
                  assigned_sub_name: 'Victoria I.',
                  assigned_subs: [
                    {
                      assignment_id: 'assign-partial-1',
                      sub_id: 'sub-victoria',
                      sub_name: 'Victoria I.',
                      is_partial: true,
                      partial_start_time: '08:00',
                      partial_end_time: '10:30',
                    },
                  ],
                },
              ],
            }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ shift_key: '2026-03-10|slot-1', status: 'available' }]),
        }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as any

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Victoria I\. \(partial 8 am to 10:30 am\)/i)).toBeInTheDocument()
      expect(screen.getByText(/1 partial shift sub already assigned\./i)).toBeInTheDocument()
    })

    const checkbox = screen.getByRole('checkbox', { name: /Tue Mar 10 • AM • Preschool/i })
    expect(checkbox).not.toBeDisabled()
  })

  it('shows Add as partial vs Replace radio options and From/To or Partial checkbox by choice', async () => {
    const user = userEvent.setup()
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: '2026-03-10|dow-2|slot-1',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-1',
                  has_time_off: true,
                  time_off_request_id: 'tor-existing',
                  assignment_id: 'assign-partial-1',
                  assigned_sub_id: 'sub-victoria',
                  assigned_sub_name: 'Victoria I.',
                  assigned_subs: [
                    {
                      assignment_id: 'assign-partial-1',
                      sub_id: 'sub-victoria',
                      sub_name: 'Victoria I.',
                      is_partial: true,
                      partial_start_time: '08:00',
                      partial_end_time: '10:30',
                    },
                  ],
                },
              ],
            }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ shift_key: '2026-03-10|slot-1', status: 'available' }]),
        }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as any

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Victoria I\. \(partial 8 am to 10:30 am\)/i)).toBeInTheDocument()
    })

    const shiftCheckbox = screen.getByRole('checkbox', { name: /Tue Mar 10 • AM • Preschool/i })
    await user.click(shiftCheckbox)

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /Add .+ as a partial shift sub/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('radio', {
          name: /Replace Victoria I\. with .+ as a full or partial shift sub/i,
        })
      ).toBeInTheDocument()
    })

    const addPartialRadio = screen.getByRole('radio', {
      name: /Add .+ as a partial shift sub/i,
    })
    expect(addPartialRadio).toBeChecked()
    expect(screen.queryByLabelText('Partial start time')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Partial end time')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('radio', {
        name: /Replace Victoria I\. with .+ as a full or partial shift sub/i,
      })
    )

    await waitFor(() => {
      const replaceRadio = screen.getByRole('radio', {
        name: /Replace Victoria I\. with .+ as a full or partial shift sub/i,
      })
      expect(replaceRadio).toBeChecked()
      const partialCheckbox = screen.getByRole('checkbox', {
        name: /Partial shift \(sub covers part of this shift\)/i,
      })
      expect(partialCheckbox).toBeInTheDocument()
      expect(partialCheckbox).not.toBeChecked()
    })

    expect(screen.queryByLabelText('Partial start time')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Partial end time')).not.toBeInTheDocument()

    const partialCheckbox = screen.getByRole('checkbox', {
      name: /Partial shift \(sub covers part of this shift\)/i,
    })
    await user.click(partialCheckbox)

    await waitFor(() => {
      expect(partialCheckbox).toBeChecked()
      expect(screen.getByLabelText('Partial start time')).toBeInTheDocument()
      expect(screen.getByLabelText('Partial end time')).toBeInTheDocument()
    })
  })

  it('sends partial payload with selected_shift_ids union and partial_start/end keys', async () => {
    const user = userEvent.setup()
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: '2026-03-10|dow-2|slot-2',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-2',
                  time_slot_code: 'PM',
                  classroom_id: 'class-1',
                  has_time_off: true,
                  time_off_request_id: 'tor-existing',
                },
              ],
            }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ shift_key: '2026-03-10|slot-2', status: 'available' }]),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/assign-shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ assignments_created: 1, assigned_shifts: [{}], success: true }),
        }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as any

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    const checkbox = await screen.findByRole('checkbox', { name: /Tue Mar 10 • PM • Preschool/i })
    await user.click(checkbox)
    await user.click(screen.getByLabelText(/Partial shift/i))
    const timeInputs = document.querySelectorAll('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '09:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '10:15' } })

    await user.click(screen.getByRole('button', { name: /Assign 1 shift/i }))

    await waitFor(() => {
      const assignCall = (global.fetch as jest.Mock).mock.calls.find((call: any[]) =>
        String(call[0]).includes('/api/sub-finder/assign-shifts')
      )
      expect(assignCall).toBeTruthy()
      const payload = JSON.parse(assignCall[1].body)
      expect(payload.selected_shift_ids).toEqual(['crs-2'])
      expect(payload.partial_assignments).toEqual([
        {
          shift_id: 'crs-2',
          partial_start_time: '09:00',
          partial_end_time: '10:15',
        },
      ])
    })
  })

  it('multi-room floater: explains partial shift is unavailable under floater option; partial appears under one-room radio', async () => {
    const user = userEvent.setup()
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: 'shift-infant',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-infant',
                  has_time_off: true,
                  time_off_request_id: 'tor-mr-partial',
                },
                {
                  id: 'shift-toddler',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-toddler',
                  has_time_off: true,
                  time_off_request_id: 'tor-mr-partial',
                },
              ],
            }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/classrooms/class-infant')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Infant Room' }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/classrooms/class-toddler')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Toddler A Room' }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ shift_key: '2026-03-10|slot-1', status: 'available' }]),
        }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as jest.Mock

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    const rowCheckbox = await screen.findByRole('checkbox', {
      name: /Tue Mar 10 • AM • Infant Room, Toddler A Room/i,
    })
    await user.click(rowCheckbox)

    await waitFor(() => {
      expect(
        screen.getByText(
          /Partial shift \(time range\) isn'?t available when covering both rooms as a floater/i
        )
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('radio', { name: /Assign to Infant Room only/i }))
    const partialCheckbox = screen.getByRole('checkbox', {
      name: /Partial shift \(sub covers part of this shift\)/i,
    })
    expect(partialCheckbox).toBeInTheDocument()
    await user.click(partialCheckbox)
    expect(partialCheckbox).toBeChecked()
    expect(
      screen.queryByText(
        /Partial shift \(time range\) isn'?t available when covering both rooms as a floater/i
      )
    ).not.toBeInTheDocument()
  })

  it('multi-room absence with conflict_teaching: shows per-room coverage, reassign option, and assigns one crs when one room + floater', async () => {
    const user = userEvent.setup()
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: 'shift-infant',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-infant',
                  has_time_off: true,
                  time_off_request_id: 'tor-multi',
                },
                {
                  id: 'shift-toddler',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-toddler',
                  has_time_off: true,
                  time_off_request_id: 'tor-multi',
                },
              ],
            }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/classrooms/class-infant')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Infant Room' }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/classrooms/class-toddler')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Toddler A Room' }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                shift_key: '2026-03-10|slot-1',
                status: 'conflict_teaching',
                message: 'Conflict: teaching elsewhere',
                conflict_classroom_name: 'Green Room',
                conflict_classroom_id: 'class-green',
              },
            ]),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/coverage-request/tor-multi')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              coverage_request_id: 'cr-multi',
              shift_map: {
                '2026-03-10|AM|class-infant': 'crs-infant',
                '2026-03-10|AM|class-toddler': 'crs-toddler',
              },
            }),
        }) as Promise<Response>
      }
      if (
        urlStr.includes(
          '/api/sub-finder/substitute-contacts?coverage_request_id=cr-multi&sub_id=sub-1'
        )
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'contact-multi' }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/substitute-contacts') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/assign-shifts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ assignments_created: 1, assigned_shifts: [{}] }),
        }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as jest.Mock

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(screen.getByText(/Coverage for this slot/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('radio', { name: /Assign to Infant Room only/i })).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: /Assign to Toddler A Room only/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('radio', {
        name: /Reassign staff here \(staff will be removed from baseline assignment for this shift only\)/i,
      })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Assign to Infant Room only/i }))
    await user.click(
      screen.getByRole('radio', {
        name: /Assign as Floater \(0\.5 in selected room \+ 0\.5 existing teaching assignment\)/i,
      })
    )

    await user.click(screen.getByRole('button', { name: /Assign 1 shift/i }))

    await waitFor(() => {
      const assignCall = (global.fetch as jest.Mock).mock.calls.find((call: any[]) =>
        String(call[0]).includes('/api/sub-finder/assign-shifts')
      )
      expect(assignCall).toBeTruthy()
      const payload = JSON.parse(assignCall[1].body)
      expect(payload.selected_shift_ids).toEqual(['crs-infant'])
      expect(payload.is_floater_shift_ids).toEqual(['crs-infant'])
      expect(payload.resolutions).toEqual({ 'crs-infant': 'floater' })
    })
  })

  it('uses reassignment flow for conflict_teaching when user selects reassign', async () => {
    const user = userEvent.setup()
    const defaultFetch = global.fetch as jest.Mock
    global.fetch = jest.fn((url: string | URL | globalThis.Request, options?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/assign-sub/shifts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              shifts: [
                {
                  id: '2026-03-10|dow-2|slot-1',
                  date: '2026-03-10',
                  day_of_week_id: 'dow-2',
                  time_slot_id: 'slot-1',
                  time_slot_code: 'AM',
                  classroom_id: 'class-target',
                  has_time_off: true,
                  time_off_request_id: 'tor-existing',
                },
              ],
            }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/classrooms/class-target')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Infant Room' }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/check-conflicts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                shift_key: '2026-03-10|slot-1',
                status: 'conflict_teaching',
                message: 'Conflict: Assigned to Green Room',
                conflict_classroom_name: 'Green Room',
                conflict_classroom_id: 'class-source',
              },
            ]),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/coverage-request/tor-existing')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              coverage_request_id: 'cr-1',
              shift_map: {
                '2026-03-10|AM|class-target': 'crs-1',
                '2026-03-10|AM': 'crs-1',
              },
            }),
        }) as Promise<Response>
      }
      if (
        urlStr.includes('/api/sub-finder/substitute-contacts?coverage_request_id=cr-1&sub_id=sub-1')
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'contact-1' }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/substitute-contacts') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/staffing-events/flex') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: 'event-1', shift_count: 1, linked_sub_assignment_count: 1 }),
        }) as Promise<Response>
      }
      if (urlStr.includes('/api/sub-finder/assign-shifts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ assignments_created: 0 }),
        }) as Promise<Response>
      }
      return defaultFetch(url, options)
    }) as any

    renderWithQueryClient(<AssignSubPanel isOpen={true} onClose={jest.fn()} />)
    await fillForm(user)

    await waitFor(() => {
      expect(
        screen.getByText(/Sub is assigned to Green Room during this time\./i)
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('radio', { name: /Move sub here \(remove sub from other room\)/i })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('radio', {
        name: /Reassign staff here \(staff will be removed from baseline assignment for this shift only\)/i,
      })
    )

    await user.click(screen.getByRole('button', { name: /Assign 1 shift/i }))

    await waitFor(() => {
      const reassignCall = (global.fetch as jest.Mock).mock.calls.find((call: any[]) =>
        String(call[0]).includes('/api/staffing-events/flex')
      )
      expect(reassignCall).toBeTruthy()
      const payload = JSON.parse(reassignCall[1].body)
      expect(payload.event_category).toBe('reassignment')
      expect(payload.shifts).toEqual([
        expect.objectContaining({
          date: '2026-03-10',
          time_slot_id: 'slot-1',
          classroom_id: 'class-target',
          source_classroom_id: 'class-source',
          coverage_request_shift_id: 'crs-1',
        }),
      ])
    })

    const assignShiftCalls = (global.fetch as jest.Mock).mock.calls.filter((call: any[]) =>
      String(call[0]).includes('/api/sub-finder/assign-shifts')
    )
    expect(assignShiftCalls).toHaveLength(0)
  })
})
