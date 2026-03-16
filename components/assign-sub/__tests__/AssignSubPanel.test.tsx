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

    const checkboxes = screen.getAllByRole('checkbox')

    // crs-1 is unavailable, but should NOT be disabled
    expect(checkboxes[0]).not.toBeDisabled()

    // User can select the unavailable (AM) shift
    const amCheckbox = screen.getByRole('checkbox', {
      name: /Tue Mar 10 • AM • Preschool/i,
    })
    await user.click(amCheckbox)
    await waitFor(() => expect(amCheckbox).toBeChecked())

    // Summary should show override warning or manual-override hint (conflictCount or per-shift hint)
    await waitFor(() => {
      const overrideSummary = screen.queryByText(
        /1 selected shift overrides the sub's availability or existing assignment/i
      )
      const manualOverrideHint = screen.queryByText(/Manual override available/i)
      expect(overrideSummary ?? manualOverrideHint).toBeTruthy()
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

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).not.toBeDisabled()

    // User can select it and assign despite being unqualified
    await user.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()
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

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).toBeDisabled()
    expect(checkboxes[1]).not.toBeDisabled()
  })
})
