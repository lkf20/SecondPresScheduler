/* eslint-disable react/display-name */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ScheduleSidePanel from '@/components/schedules/ScheduleSidePanel'

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const pushMock = jest.fn()
const toastSuccessMock = jest.fn()
const toastErrorMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: jest.fn(),
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

jest.mock('@/lib/hooks/use-display-name-format', () => ({
  useDisplayNameFormat: () => ({ format: 'first_last_initial' }),
}))

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
}))

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (
    <div>
      <button type="button" aria-label="Close panel" onClick={() => onOpenChange?.(false)}>
        Close panel
      </button>
      {children}
    </div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type || 'button'} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: () => <input type="checkbox" />,
}))

jest.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode
    onValueChange?: (value: string) => void
  }) => (
    <div
      role="radiogroup"
      onClick={(e: React.MouseEvent) => {
        const el = (e.target as HTMLElement).closest?.('[data-value]')
        if (el && onValueChange) {
          onValueChange((el as HTMLElement).getAttribute('data-value') ?? '')
        }
      }}
    >
      {children}
    </div>
  ),
  RadioGroupItem: ({ id, value }: { id: string; value: string }) => (
    <input id={id} value={value} type="radio" data-value={value} readOnly />
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

jest.mock('@/components/ui/textarea', () => ({
  Textarea: () => <textarea />,
}))

jest.mock('@/components/ui/date-picker-input', () => () => <input />)

jest.mock('@/components/time-off/TimeOffForm', () => () => <div>TimeOffForm</div>)
jest.mock('@/components/schedules/SlotStatusToggle', () => () => <div>SlotStatusToggle</div>)
jest.mock('@/components/settings/ClassSelector', () => () => <div>ClassSelector</div>)
jest.mock('@/components/schedules/EnrollmentInput', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    disabled,
    hideLabel,
  }: {
    value: number | null
    onChange: (v: number | null) => void
    disabled?: boolean
    hideLabel?: boolean
  }) => (
    <div>
      {!hideLabel && <label htmlFor="enrollment-input">Enrollment</label>}
      <input
        id="enrollment-input"
        data-testid="enrollment-input"
        type="number"
        min={1}
        value={value ?? ''}
        disabled={disabled}
        onChange={e => {
          const v = e.target.value
          if (v === '') onChange(null)
          else {
            const n = parseInt(v, 10)
            if (!Number.isNaN(n) && n > 0) onChange(n)
          }
        }}
      />
    </div>
  ),
}))
jest.mock('@/components/schedules/TeacherMultiSelect', () => () => <div>TeacherMultiSelect</div>)
jest.mock('@/components/schedules/MultiDayApplySelector', () => ({
  __esModule: true,
  default: ({
    disabled,
    onApplyScopeChange,
  }: {
    disabled?: boolean
    onApplyScopeChange?: (
      scope: 'single' | 'timeSlot' | 'day',
      dayIds: string[],
      timeSlotIds?: string[]
    ) => void
  }) => (
    <div data-testid="multi-day-apply" data-disabled={disabled ? 'true' : 'false'}>
      MultiDayApplySelector
      {onApplyScopeChange && (
        <button
          type="button"
          onClick={() => onApplyScopeChange('timeSlot', ['day-1', 'day-2'])}
          aria-label="Apply to other days"
        >
          Apply to other days
        </button>
      )}
    </div>
  ),
}))
jest.mock('@/components/schedules/UnsavedChangesDialog', () => {
  return function UnsavedChangesDialogMock(props: {
    isOpen: boolean
    blockSaveReason?: string | null
    saveError?: string | null
    saving?: boolean
    onSave?: () => void
  }) {
    if (!props.isOpen) return null
    const saveDisabled = props.saving || !!props.saveError || !!props.blockSaveReason
    return (
      <div
        data-testid="unsaved-dialog"
        data-block-save-reason={String(props.blockSaveReason ?? '')}
        data-save-error={String(props.saveError ?? '')}
      >
        <button type="button" disabled={saveDisabled} onClick={() => props.onSave?.()}>
          Save
        </button>
        {props.blockSaveReason ? (
          <span data-testid="block-reason-text">{props.blockSaveReason}</span>
        ) : null}
        {props.saveError ? <span data-testid="save-error-text">{props.saveError}</span> : null}
      </div>
    )
  }
})
jest.mock('@/components/schedules/ConflictBanner', () => () => <div>ConflictBanner</div>)

const originalFetch = global.fetch

const setupFetch = (
  removeContext: {
    start_date: string
    end_date: string
    weekdays: string[]
    matching_shift_count: number
  },
  options?: {
    checkConflictsResponse?: { conflicts: any[] }
    teacherSchedulesResponse?: any[]
    /** When set, capture the request body of PUT /api/schedule-cells/bulk for assertions */
    onBulkSave?: (body: { updates: Array<{ enrollment_for_staffing?: number | null }> }) => void
    /** When set, used for check-conflicts; return conflicts for apply (multi-cell) requests when desired */
    getCheckConflictsResponse?: (body: {
      checks: Array<{ day_of_week_id: string; time_slot_id: string }>
    }) => { conflicts: any[] }
    /** When set, fail PUT /api/schedule-cells/bulk with this error message */
    bulkSaveFailureMessage?: string
    /** When set, capture body of PUT /api/teacher-schedules/bulk-apply */
    onBulkTeacherApply?: (body: {
      target_cells: Array<{
        classroom_id: string
        day_of_week_id: string
        time_slot_id: string
      }>
      teachers: Array<{ teacher_id: string; is_floater: boolean }>
    }) => void
    /** When set, fail PUT /api/teacher-schedules/bulk-apply with this message */
    bulkTeacherApplyFailureMessage?: string
  }
) => {
  const checkConflictsResponse = options?.checkConflictsResponse ?? { conflicts: [] }
  const teacherSchedulesResponse = options?.teacherSchedulesResponse
  const onBulkSave = options?.onBulkSave
  const getCheckConflictsResponse = options?.getCheckConflictsResponse
  const bulkSaveFailureMessage = options?.bulkSaveFailureMessage
  const onBulkTeacherApply = options?.onBulkTeacherApply
  const bulkTeacherApplyFailureMessage = options?.bulkTeacherApplyFailureMessage

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url.includes('/api/timeslots')) {
      return {
        ok: true,
        json: async () => [{ id: 'slot-1', code: 'EM', name: 'Early Morning' }],
      } as Response
    }
    if (url.includes('/api/classrooms')) {
      return {
        ok: true,
        json: async () => [{ id: 'class-1', allowed_classes: [] }],
      } as Response
    }
    if (url.includes('/api/class-groups?includeInactive=true')) {
      return {
        ok: true,
        json: async () => [],
      } as Response
    }
    if (url.includes('/api/teacher-schedules/check-conflicts')) {
      let response = checkConflictsResponse
      if (getCheckConflictsResponse && init?.body) {
        try {
          const body = JSON.parse(init.body as string) as {
            checks?: Array<{ day_of_week_id: string; time_slot_id: string }>
          }
          if (body.checks) response = getCheckConflictsResponse(body)
        } catch {
          // keep default
        }
      }
      return {
        ok: true,
        json: async () => response,
      } as Response
    }
    if (url.includes('/api/teacher-schedules/bulk-apply') && init?.method === 'PUT' && init?.body) {
      const body = JSON.parse(init.body as string) as {
        target_cells: Array<{
          classroom_id: string
          day_of_week_id: string
          time_slot_id: string
        }>
        teachers: Array<{ teacher_id: string; is_floater: boolean }>
      }
      onBulkTeacherApply?.(body)
      if (bulkTeacherApplyFailureMessage) {
        return {
          ok: false,
          json: async () => ({ error: bulkTeacherApplyFailureMessage }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ target_cell_count: body.target_cells.length }),
      } as Response
    }
    if (url.includes('/api/teacher-schedules')) {
      if (teacherSchedulesResponse) {
        return {
          ok: true,
          json: async () => teacherSchedulesResponse,
        } as Response
      }
      // Return teachers matching buildProps() so panel populates and async updates complete predictably
      return {
        ok: true,
        json: async () => [
          {
            id: 'ts-1',
            classroom_id: 'class-1',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            teacher_id: 'teacher-1',
            is_floater: false,
            teacher: {
              first_name: 'Bella',
              last_name: 'Wilson',
              display_name: null,
              staff_role_type_assignments: [],
            },
          },
          {
            id: 'ts-2',
            classroom_id: 'class-1',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            teacher_id: 'teacher-2',
            is_floater: false,
            teacher: {
              first_name: 'Amy',
              last_name: 'Park',
              display_name: null,
              staff_role_type_assignments: [{ staff_role_types: { code: 'FLEXIBLE' } }],
            },
          },
        ],
      } as Response
    }
    if (url.includes('/api/staffing-events/flex/remove?')) {
      return {
        ok: true,
        json: async () => removeContext,
      } as Response
    }
    if (url.includes('/api/schedule-cells?')) {
      return {
        ok: true,
        json: async () => [],
      } as Response
    }
    if (url.includes('/api/dashboard/slot-run?')) {
      return {
        ok: true,
        json: async () => ({
          belowTarget: true,
          dateStart: '2026-03-09',
          dateEnd: '2026-05-11',
          weeksLabel: '9 weeks',
          targetType: 'required',
        }),
      } as Response
    }
    if (url.includes('/api/staffing-events/flex/availability')) {
      return {
        ok: true,
        json: async () => ({
          staff: [{ id: 's1', name: 'Test Staff', availableShiftKeys: [] }],
          shift_metrics: [],
          day_options: [],
        }),
      } as Response
    }
    if (url.includes('/api/schedule-cells/bulk') && init?.method === 'PUT' && init?.body) {
      const body = JSON.parse(init.body as string) as {
        updates: Array<{ enrollment_for_staffing?: number | null }>
      }
      onBulkSave?.(body)
      if (bulkSaveFailureMessage) {
        return {
          ok: false,
          json: async () => ({ error: bulkSaveFailureMessage }),
        } as Response
      }
      return {
        ok: true,
        json: async () => body.updates ?? [],
      } as Response
    }
    return {
      ok: true,
      json: async () => ({}),
    } as Response
  }) as jest.Mock
}

const buildProps = () => ({
  isOpen: true,
  onClose: jest.fn(),
  dayId: 'day-1',
  dayName: 'Monday',
  timeSlotId: 'slot-1',
  timeSlotName: 'Early Morning',
  timeSlotCode: 'EM',
  timeSlotStartTime: '08:00',
  timeSlotEndTime: '10:00',
  classroomId: 'class-1',
  classroomName: 'Infant Room',
  selectedDayIds: ['day-1'],
  weekStartISO: '2026-02-09',
  readOnly: true,
  selectedCellData: {
    day_of_week_id: 'day-1',
    day_name: 'Monday',
    day_number: 1,
    time_slot_id: 'slot-1',
    time_slot_code: 'EM',
    time_slot_name: 'Early Morning',
    time_slot_display_order: 1,
    assignments: [
      {
        id: 'a-1',
        teacher_id: 'teacher-1',
        teacher_name: 'Bella W.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
      },
      {
        id: 'a-flex',
        teacher_id: 'teacher-2',
        teacher_name: 'Amy P.',
        classroom_id: 'class-1',
        classroom_name: 'Infant Room',
        is_flexible: true,
        staffing_event_id: 'event-1',
      },
    ],
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
    absences: [],
  },
})

describe('ScheduleSidePanel interactions', () => {
  jest.setTimeout(10000)

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('uses single-choice weekly note controls and hides preview when unchanged from baseline', async () => {
    setupFetch({
      start_date: '2026-03-10',
      end_date: '2026-03-17',
      weekdays: ['Monday'],
      matching_shift_count: 2,
    })
    const props = buildProps()

    renderWithQueryClient(<ScheduleSidePanel {...props} />)

    await waitFor(() => {
      expect(screen.getByText("This date's note")).toBeInTheDocument()
    })

    expect(screen.getByText('Use baseline note')).toBeInTheDocument()
    expect(screen.getByText('Custom note')).toBeInTheDocument()
    expect(screen.getByText('Hide for this date')).toBeInTheDocument()
    expect(
      screen.getByText('Applies only to this date. Baseline note is unchanged.')
    ).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Add a note for this date...')).not.toBeInTheDocument()
    expect(screen.queryByText('Displayed in this weekly cell')).not.toBeInTheDocument()
  })

  it('shows preview when weekly note result differs from baseline (including hidden mode)', async () => {
    setupFetch({
      start_date: '2026-03-10',
      end_date: '2026-03-17',
      weekdays: ['Monday'],
      matching_shift_count: 2,
    })
    const props = buildProps()
    const selectedCellData = {
      ...props.selectedCellData,
      schedule_cell: {
        ...props.selectedCellData.schedule_cell,
        notes: 'Jenn S. 12:15',
        weekly_note_override: {
          override_mode: 'hidden' as const,
          note: null,
        },
      },
    }

    renderWithQueryClient(<ScheduleSidePanel {...props} selectedCellData={selectedCellData} />)

    await waitFor(() => {
      expect(screen.getByText('Displayed in this weekly cell')).toBeInTheDocument()
    })

    expect(screen.getByText('No note')).toBeInTheDocument()
  })

  it('does not open unsaved dialog when closing read-only weekly cell panel after weekly-note interactions', async () => {
    setupFetch(
      {
        start_date: '2026-03-10',
        end_date: '2026-03-17',
        weekdays: ['Monday'],
        matching_shift_count: 2,
      },
      {
        // Force assignment count mismatch to emulate real-world async teacher fetch differences.
        teacherSchedulesResponse: [
          {
            id: 'ts-1',
            classroom_id: 'class-1',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            teacher_id: 'teacher-1',
            is_floater: false,
            teacher: {
              first_name: 'Bella',
              last_name: 'Wilson',
              display_name: null,
              staff_role_type_assignments: [],
            },
          },
        ],
      }
    )
    const props = buildProps()

    renderWithQueryClient(<ScheduleSidePanel {...props} />)

    await waitFor(() => {
      expect(screen.getByText('Notes')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Close panel'))

    expect(props.onClose).toHaveBeenCalled()
    expect(screen.queryByTestId('unsaved-dialog')).not.toBeInTheDocument()
  })

  it('shows absent staff only once when they are also assigned as floater in the same weekly cell', async () => {
    setupFetch({
      start_date: '2026-03-10',
      end_date: '2026-03-17',
      weekdays: ['Monday'],
      matching_shift_count: 2,
    })
    const props = buildProps()
    const selectedCellData = {
      ...props.selectedCellData,
      assignments: [
        {
          id: 'a-floater-joy',
          teacher_id: 'teacher-joy',
          teacher_name: 'Joy P.',
          classroom_id: 'class-1',
          classroom_name: 'Infant Room',
          is_floater: true,
        },
      ],
      absences: [
        {
          teacher_id: 'teacher-joy',
          teacher_name: 'Joy P.',
          has_sub: false,
          is_partial: false,
          time_off_request_id: 'tor-joy',
        },
      ],
    }

    renderWithQueryClient(<ScheduleSidePanel {...props} selectedCellData={selectedCellData} />)

    await waitFor(() => {
      expect(screen.getByText('Staff Assignments')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Joy P.')).toHaveLength(1)
    expect(screen.getByText('Absent')).toBeInTheDocument()
    expect(screen.queryByText('Floater')).not.toBeInTheDocument()
  })

  it('shows baseline Save controls only after explicit handoff from weekly read-only mode', async () => {
    setupFetch({
      start_date: '2026-03-10',
      end_date: '2026-03-17',
      weekdays: ['Monday'],
      matching_shift_count: 2,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildProps()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit baseline staff' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit baseline staff' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('opens remove flex dialog and shows multi-shift choices', async () => {
    setupFetch({
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      weekdays: ['Monday', 'Wednesday', 'Friday'],
      matching_shift_count: 6,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildProps()} />)
    await waitFor(() => expect(screen.getByText('Bella W.')).toBeInTheDocument())
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    await screen.findByText('Remove temporary coverage?')
    // Wait for flex remove context to load (dialog shows "Loading assignment details..." until then)
    await waitFor(
      () => {
        expect(screen.getByText('This shift only')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    expect(
      screen.getByText(/Amy P. is assigned for temporary coverage to Infant Room/i)
    ).toBeInTheDocument()
    expect(screen.getByText('All Monday shifts')).toBeInTheDocument()
    expect(screen.getByText('All shifts')).toBeInTheDocument()
  })

  it('uses toast errors (not browser alert) when baseline save fails', async () => {
    setupFetch(
      {
        start_date: '2026-03-10',
        end_date: '2026-03-17',
        weekdays: ['Monday'],
        matching_shift_count: 2,
      },
      { bulkSaveFailureMessage: 'Bulk save failed for test' }
    )
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    const props = { ...buildProps(), readOnly: false as const }

    renderWithQueryClient(<ScheduleSidePanel {...props} />)

    const saveButton = await screen.findByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to save: Bulk save failed for test')
    })
    expect(alertSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('shows staffing summary chip and counts in the header', async () => {
    setupFetch({
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      weekdays: ['Monday', 'Wednesday', 'Friday'],
      matching_shift_count: 6,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildProps()} />)
    await waitFor(() => expect(screen.getByText('Bella W.')).toBeInTheDocument(), { timeout: 3000 })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(await screen.findByText('Below Preferred by 1')).toBeInTheDocument()
    expect(screen.getByText('Required: 2 • Preferred: 3 • Scheduled: 2')).toBeInTheDocument()
  })

  it('supports baseline edit handoff and return to cell panel', async () => {
    setupFetch({
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      weekdays: ['Monday', 'Wednesday', 'Friday'],
      matching_shift_count: 6,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildProps()} />)

    await waitFor(
      () => {
        expect(screen.getByText('Bella W.')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    fireEvent.click(await screen.findByRole('button', { name: /edit baseline staff/i }))
    expect(screen.getByText('Edit baseline assignment?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(screen.getByText('Edit Permanent Staff')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument()
  })

  it('hides Remove button for temporary coverage assignments without staffing_event_id', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    // Flex assignment from baseline (teacher with FLEXIBLE role) - no staffing_event_id
    const propsWithoutEventId = {
      ...buildProps(),
      selectedCellData: {
        ...buildProps().selectedCellData,
        assignments: [
          {
            id: 'a-1',
            teacher_id: 'teacher-1',
            teacher_name: 'Bella W.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
          },
          {
            id: 'a-flex-baseline',
            teacher_id: 'teacher-2',
            teacher_name: 'Amy P.',
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
            is_flexible: true,
            staffing_event_id: undefined,
          },
        ],
      },
    }

    renderWithQueryClient(<ScheduleSidePanel {...propsWithoutEventId} />)
    await waitFor(() => expect(screen.getByText('Amy P.')).toBeInTheDocument(), { timeout: 3000 })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(screen.getByText('Amy P.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('shows single-shift confirmation copy with no weekday/all-shifts options', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildProps()} />)
    await waitFor(() => expect(screen.getByText('Bella W.')).toBeInTheDocument(), { timeout: 3000 })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Amy P. is assigned for temporary coverage to Infant Room on Monday, Feb 9.'
        )
      ).toBeInTheDocument()
    })
    expect(screen.queryByText('This shift only')).not.toBeInTheDocument()
    expect(screen.queryByText('All Monday shifts')).not.toBeInTheDocument()
    expect(screen.queryByText('All shifts')).not.toBeInTheDocument()
  })

  it('shows conflict banner on Baseline when teacher is already assigned in another room (same day/slot)', async () => {
    setupFetch(
      {
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        weekdays: ['Monday'],
        matching_shift_count: 1,
      },
      {
        checkConflictsResponse: {
          conflicts: [
            {
              teacher_id: 'teacher-1',
              teacher_name: 'Bella W.',
              conflicting_schedule_id: 'ts-other',
              conflicting_classroom_id: 'class-other',
              conflicting_classroom_name: 'Toddler B Room',
              day_of_week_id: 'day-1',
              day_of_week_name: 'Monday',
              time_slot_id: 'slot-1',
              time_slot_code: 'LB1',
              target_classroom_id: 'class-1',
              conflicting_role_label: 'Permanent teacher',
            },
          ],
        },
      }
    )

    // Baseline page: readOnly false so conflict check runs without needing panelMode 'editCell'
    const baselineProps = {
      ...buildProps(),
      readOnly: false,
      classroomId: 'class-silver',
      classroomName: 'Silver Room',
    }

    renderWithQueryClient(<ScheduleSidePanel {...baselineProps} />)

    // Wait for conflict check to run and ConflictBanner to appear (teachers come from selectedCellData; check-conflicts returns conflict)
    await waitFor(
      () => {
        expect(screen.getByText('ConflictBanner')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('blocks Apply when a target cell would conflict and shows clear error message', async () => {
    let bulkPutCalled = false
    setupFetch(
      {
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        weekdays: ['Monday'],
        matching_shift_count: 1,
      },
      {
        getCheckConflictsResponse: (body: {
          checks: Array<{ day_of_week_id: string; time_slot_id: string }>
        }) => {
          const pairs = new Set(body.checks.map(c => `${c.day_of_week_id}:${c.time_slot_id}`))
          return pairs.size >= 2
            ? {
                conflicts: [
                  {
                    teacher_id: 'teacher-1',
                    teacher_name: 'Bella W.',
                    conflicting_classroom_name: 'Toddler B Room',
                    day_of_week_name: 'Tuesday',
                    time_slot_code: 'EM',
                  },
                ],
              }
            : { conflicts: [] }
        },
        onBulkSave: () => {
          bulkPutCalled = true
        },
      }
    )

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedDayIds={['day-1', 'day-2']}
        selectedCellData={{
          ...props.selectedCellData,
          schedule_cell: props.selectedCellData?.schedule_cell,
        }}
      />
    )

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const applyToOtherDaysButton = screen.getByRole('button', { name: 'Apply to other days' })
    await act(async () => {
      fireEvent.click(applyToOtherDaysButton)
    })

    const saveButton = screen.getByRole('button', { name: 'Save' })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/Cannot apply:/)).toBeInTheDocument()
      expect(
        screen.getByText(/Bella W\. is already scheduled in Toddler B Room for Tuesday EM/)
      ).toBeInTheDocument()
    })
    expect(bulkPutCalled).toBe(false)
  })

  it('Apply to multiple cells with no conflicts succeeds (bulk and teacher-schedule flow run)', async () => {
    let bulkPutCalled = false
    setupFetch(
      {
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        weekdays: ['Monday'],
        matching_shift_count: 1,
      },
      {
        getCheckConflictsResponse: () => ({ conflicts: [] }),
        onBulkSave: () => {
          bulkPutCalled = true
        },
      }
    )

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedDayIds={['day-1', 'day-2']}
        selectedCellData={{
          ...props.selectedCellData,
          schedule_cell: props.selectedCellData?.schedule_cell,
        }}
      />
    )

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const applyToOtherDaysButton = screen.getByRole('button', { name: 'Apply to other days' })
    await act(async () => {
      fireEvent.click(applyToOtherDaysButton)
    })

    const saveButton = screen.getByRole('button', { name: 'Save' })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(bulkPutCalled).toBe(true)
    })
  })

  it('Apply to multiple cells sends floater flags through bulk teacher apply payload', async () => {
    let bulkTeacherApplyBody: {
      target_cells: Array<{
        classroom_id: string
        day_of_week_id: string
        time_slot_id: string
      }>
      teachers: Array<{ teacher_id: string; is_floater: boolean }>
    } | null = null

    setupFetch(
      {
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        weekdays: ['Monday'],
        matching_shift_count: 1,
      },
      {
        getCheckConflictsResponse: () => ({ conflicts: [] }),
        teacherSchedulesResponse: [
          {
            id: 'ts-1',
            classroom_id: 'class-1',
            day_of_week_id: 'day-1',
            time_slot_id: 'slot-1',
            teacher_id: 'teacher-1',
            is_floater: true,
            teacher: {
              first_name: 'Bella',
              last_name: 'Wilson',
              display_name: null,
              staff_role_type_assignments: [],
            },
          },
        ],
        onBulkTeacherApply: body => {
          bulkTeacherApplyBody = body
        },
      }
    )

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedDayIds={['day-1', 'day-2']}
        selectedCellData={{
          ...props.selectedCellData,
          schedule_cell: props.selectedCellData?.schedule_cell,
          assignments: [
            {
              id: 'a-1',
              teacher_id: 'teacher-1',
              teacher_name: 'Bella W.',
              classroom_id: 'class-1',
              classroom_name: 'Infant Room',
              is_floater: true,
            },
          ],
        }}
      />
    )

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const applyToOtherDaysButton = screen.getByRole('button', { name: 'Apply to other days' })
    await act(async () => {
      fireEvent.click(applyToOtherDaysButton)
    })

    const saveButton = screen.getByRole('button', { name: 'Save' })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(bulkTeacherApplyBody).not.toBeNull()
    })
    expect(bulkTeacherApplyBody!.teachers).toEqual([{ teacher_id: 'teacher-1', is_floater: true }])
    expect(bulkTeacherApplyBody!.target_cells).toHaveLength(2)
  })

  it('Unsaved dialog shows block reason and disables Save when user has direct-assignment conflicts and tries to close', async () => {
    setupFetch(
      {
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        weekdays: ['Monday'],
        matching_shift_count: 1,
      },
      {
        checkConflictsResponse: {
          conflicts: [
            {
              teacher_id: 'teacher-1',
              teacher_name: 'Bella W.',
              conflicting_schedule_id: 'ts-other',
              conflicting_classroom_id: 'class-other',
              conflicting_classroom_name: 'Toddler B Room',
              day_of_week_id: 'day-1',
              day_of_week_name: 'Monday',
              time_slot_id: 'slot-1',
              time_slot_code: 'EM',
              target_classroom_id: 'class-1',
              conflicting_role_label: 'Permanent teacher',
            },
          ],
        },
      }
    )

    const props = buildProps()
    const selectedCellDataEmptyThenFilled = {
      ...props.selectedCellData,
      assignments: [],
      schedule_cell: props.selectedCellData?.schedule_cell,
    }

    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedCellData={selectedCellDataEmptyThenFilled}
      />
    )

    await waitFor(() => expect(screen.getByText('ConflictBanner')).toBeInTheDocument(), {
      timeout: 3000,
    })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await act(async () => {
      fireEvent.click(cancelButton)
    })

    const dialog = screen.getByTestId('unsaved-dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute(
      'data-block-save-reason',
      'Resolve scheduling conflicts in the panel before saving.'
    )
    expect(screen.getByTestId('block-reason-text')).toHaveTextContent(
      'Resolve scheduling conflicts in the panel before saving.'
    )
    const saveInDialog = screen.getByTestId('unsaved-dialog').querySelector('button')
    expect(saveInDialog).toBeDisabled()
  })

  it('Unsaved dialog shows save error and disables Save when user has Apply conflict and clicks Save from dialog', async () => {
    let bulkPutCalled = false
    setupFetch(
      {
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        weekdays: ['Monday'],
        matching_shift_count: 1,
      },
      {
        getCheckConflictsResponse: (body: {
          checks: Array<{ day_of_week_id: string; time_slot_id: string }>
        }) => {
          const pairs = new Set(body.checks.map(c => `${c.day_of_week_id}:${c.time_slot_id}`))
          return pairs.size >= 2
            ? {
                conflicts: [
                  {
                    teacher_name: 'Anne M.',
                    conflicting_classroom_name: 'Infant Room',
                    day_of_week_name: 'Monday',
                    time_slot_code: 'EM',
                  },
                ],
              }
            : { conflicts: [] }
        },
        onBulkSave: () => {
          bulkPutCalled = true
        },
      }
    )

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedDayIds={['day-1', 'day-2']}
        selectedCellData={{
          ...props.selectedCellData,
          schedule_cell: props.selectedCellData?.schedule_cell,
        }}
      />
    )

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const enrollmentInput = screen.getByTestId('enrollment-input')
    await act(async () => {
      fireEvent.change(enrollmentInput, { target: { value: '9' } })
    })

    const applyToOtherDaysButton = screen.getByRole('button', { name: 'Apply to other days' })
    await act(async () => {
      fireEvent.click(applyToOtherDaysButton)
    })

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await act(async () => {
      fireEvent.click(cancelButton)
    })

    const dialog = screen.getByTestId('unsaved-dialog')
    expect(dialog).toBeInTheDocument()
    expect(bulkPutCalled).toBe(false)

    const saveInDialog = dialog.querySelector('button')
    expect(saveInDialog).not.toBeDisabled()
    await act(async () => {
      fireEvent.click(saveInDialog!)
    })

    await waitFor(
      () => {
        expect(screen.getByTestId('save-error-text')).toHaveTextContent(/Cannot apply:/)
        expect(screen.getByTestId('save-error-text')).toHaveTextContent(
          /Anne M\. is already scheduled in Infant Room for Monday EM/
        )
      },
      { timeout: 3000 }
    )
    const saveButtonAfterError = screen.getByTestId('unsaved-dialog').querySelector('button')
    expect(saveButtonAfterError).toBeDisabled()
    expect(bulkPutCalled).toBe(false)
  })

  it('keeps Save enabled when slot is inactive so user can persist deactivation or other changes', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedCellData={{
          ...props.selectedCellData,
          schedule_cell: {
            ...props.selectedCellData.schedule_cell,
            is_active: false,
          },
        }}
      />
    )

    // Save is not disabled when slot is inactive (user can save deactivation or reopen and save)
    const saveButton = await screen.findByRole('button', { name: 'Save' })
    expect(saveButton).not.toBeDisabled()
    expect(screen.getByTestId('multi-day-apply')).toHaveAttribute('data-disabled', 'true')
  })

  it('saves user-entered enrollment for single class group (By total mode, not by_class_group)', async () => {
    let bulkSaveBody: { updates: Array<{ enrollment_for_staffing?: number | null }> } | null = null
    setupFetch(
      {
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        weekdays: ['Monday'],
        matching_shift_count: 1,
      },
      {
        onBulkSave: body => {
          bulkSaveBody = body
        },
      }
    )

    const props = buildProps()
    const selectedCellData = {
      ...props.selectedCellData,
      schedule_cell: {
        ...props.selectedCellData!.schedule_cell,
        enrollment_for_staffing: 5,
        class_groups: [
          {
            id: 'cg-1',
            name: 'Infant A',
            min_age: 1,
            max_age: 2,
            required_ratio: 4,
            preferred_ratio: 3,
            enrollment: 5,
          },
        ],
      },
    }

    renderWithQueryClient(
      <ScheduleSidePanel {...props} readOnly={false} selectedCellData={selectedCellData} />
    )

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const enrollmentInput = screen.getByTestId('enrollment-input')
    expect(enrollmentInput).toHaveValue(5)
    await act(async () => {
      fireEvent.change(enrollmentInput, { target: { value: '8' } })
    })

    const saveButton = await screen.findByRole('button', { name: 'Save' })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(bulkSaveBody).toBeDefined()
      expect(bulkSaveBody!.updates[0].enrollment_for_staffing).toBe(8)
    })
  })

  it('shows class group required message only when slot is active', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedCellData={{
          ...props.selectedCellData!,
          schedule_cell: {
            ...props.selectedCellData!.schedule_cell,
            class_groups: [],
          },
        }}
      />
    )

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    // When slot is active and no class groups: show warning (class groups required when active)
    expect(
      screen.getByText('At least one class group is required when slot is active')
    ).toBeInTheDocument()
  })

  it('disables quick actions in read-only cell panel when slot is inactive', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly
        selectedCellData={{
          ...props.selectedCellData,
          schedule_cell: {
            ...props.selectedCellData.schedule_cell,
            is_active: false,
          },
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Add Temporary Coverage' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit baseline staff' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Edit class groups, enrollment & ratios' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()

    const addTimeOffButtons = screen.getAllByRole('button', { name: 'Add Time Off' })
    addTimeOffButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('disables Save and Apply when classroom is inactive (parent inactive)', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedCellData={{
          ...props.selectedCellData,
          classroom_is_active: false,
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByTestId('multi-day-apply')).toHaveAttribute('data-disabled', 'true')
  })

  it('disables Save and Apply when time slot is inactive (parent inactive)', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly={false}
        selectedCellData={{
          ...props.selectedCellData,
          time_slot_is_active: false,
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByTestId('multi-day-apply')).toHaveAttribute('data-disabled', 'true')
  })

  it('disables quick actions when classroom is inactive (parent inactive)', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly
        selectedCellData={{
          ...props.selectedCellData,
          classroom_is_active: false,
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Add Temporary Coverage' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit baseline staff' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Edit class groups, enrollment & ratios' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()

    const addTimeOffButtons = screen.getAllByRole('button', { name: 'Add Time Off' })
    addTimeOffButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('disables quick actions when time slot is inactive (parent inactive)', async () => {
    setupFetch({
      start_date: '2026-02-09',
      end_date: '2026-02-09',
      weekdays: ['Monday'],
      matching_shift_count: 1,
    })

    const props = buildProps()
    renderWithQueryClient(
      <ScheduleSidePanel
        {...props}
        readOnly
        selectedCellData={{
          ...props.selectedCellData,
          time_slot_is_active: false,
        }}
      />
    )

    expect(await screen.findByRole('button', { name: 'Add Temporary Coverage' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit baseline staff' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Edit class groups, enrollment & ratios' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()

    const addTimeOffButtons = screen.getAllByRole('button', { name: 'Add Time Off' })
    addTimeOffButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})

describe('ScheduleSidePanel - Add Temporary Coverage', () => {
  jest.setTimeout(10000)

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const buildPropsFromDashboard = () => {
    const base = buildProps()
    return {
      ...base,
      selectedCellData: undefined,
      initialPanelMode: 'flex' as const,
      initialFlexStartDate: '2026-03-09',
      initialFlexEndDate: '2026-05-11',
      initialFlexTargetType: 'required' as const,
      initialFlexRequiredStaff: 2,
      initialFlexPreferredStaff: 3,
      initialFlexScheduledStaff: 1,
    }
  }

  it('from dashboard: header shows Required, Preferred, and Scheduled when initial flex staffing is passed', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildPropsFromDashboard()} />)

    await waitFor(
      () => {
        expect(screen.getByText(/Required: 2.*Preferred: 3.*Scheduled: 1/)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })
  })

  it('from dashboard: shows Summary card with run-length and suggested coverage range', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildPropsFromDashboard()} />)

    await waitFor(
      () => {
        expect(screen.getByText('Summary')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })
    expect(
      screen.getByText(/Infant Room Monday EM is below required target for the next/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Suggested coverage range: Mar 9 – May 11/)).toBeInTheDocument()
  })

  it('from dashboard: when date range is 8+ weeks shows Long-term assignment detected', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildPropsFromDashboard()} />)

    await waitFor(
      () => {
        expect(screen.getByText('Long-term assignment detected')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })
    expect(
      screen.getByText(/Assigning for a whole semester\? You might want to do this in the/)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Baseline Schedule' })).toBeInTheDocument()
  })

  it('from weekly: fetches slot-run and shows Summary when slot is below target', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildProps()} weekStartISO="2026-03-09" />)

    await waitFor(() => expect(screen.getByText('Bella W.')).toBeInTheDocument(), { timeout: 3000 })
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Add Temporary Coverage' }))

    await waitFor(
      () => {
        expect(screen.getByText('Summary')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    expect(
      screen.getByText(/Infant Room Monday EM is below required target for the next 9 weeks/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Suggested coverage range: Mar 9 – May 11/)).toBeInTheDocument()
  })

  // Break Coverage UI is hidden when BREAK_COVERAGE_ENABLED is false (see lib/feature-flags.ts).
  // Re-enable this test when the feature is turned back on.
  it.skip('shows Break Coverage fields when Break Coverage is selected', async () => {
    setupFetch({
      start_date: '2026-03-09',
      end_date: '2026-05-11',
      weekdays: ['Monday'],
      matching_shift_count: 10,
    })

    renderWithQueryClient(<ScheduleSidePanel {...buildProps()} weekStartISO="2026-03-09" />)

    await waitFor(() => expect(screen.getByText('Bella W.')).toBeInTheDocument())
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Add Temporary Coverage' }))

    const radios = await screen.findAllByRole('radio')
    const breakRadio = radios.find((r: HTMLElement) => r.getAttribute('value') === 'break')
    expect(breakRadio).toBeDefined()
    fireEvent.click(breakRadio!)

    await waitFor(() => {
      expect(screen.getByText('Teacher taking break (optional)')).toBeInTheDocument()
    })
    expect(screen.getByText('Unspecified')).toBeInTheDocument()
    expect(screen.getByText('Start Time (optional)')).toBeInTheDocument()
    expect(screen.getByText('End Time (optional)')).toBeInTheDocument()
  })
})
