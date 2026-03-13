/**
 * Tests for baseline conflict resolution, specifically that applying "mark as floater"
 * for multiple conflicts preserves all selected teachers (including those not in the conflict).
 * Uses the real ConflictBanner (not mocked) so we can interact with Apply.
 *
 * Critical: The test simulates the race that caused the bug — the preserve ref must be set at
 * the START of Apply (before any await). We delay resolve-conflict (200ms) and have the
 * teacher-schedules fetch complete earlier (100ms). So when the fetch .then() runs at 100ms,
 * we are still inside the resolve-conflict await. If the ref were set at the end of Apply
 * (after await), it would not be set yet and the .then() would overwrite with 1 teacher.
 * With the ref set at start, the .then() sees preserveRef true and skips overwriting.
 */
/* eslint-disable react/display-name */
import React, { useCallback, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ScheduleSidePanel from '@/components/schedules/ScheduleSidePanel'

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

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  default: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="multi-day-apply" data-disabled={disabled ? 'true' : 'false'}>
      MultiDayApplySelector
    </div>
  ),
}))
jest.mock('@/components/schedules/UnsavedChangesDialog', () => () => null)
// Do NOT mock ConflictBanner so we can click "Keep both — Mark as Floater" and "Apply selection"

const originalFetch = global.fetch

const baseCellData = {
  day_of_week_id: 'day-1',
  day_name: 'Monday',
  day_number: 1,
  time_slot_id: 'slot-1',
  time_slot_code: 'EM',
  time_slot_name: 'Early Morning',
  time_slot_display_order: 1,
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
  absences: [] as Array<{ teacher_name: string; has_sub: boolean }>,
}

/** Initial cell data with 3 teachers (Bella, Amy, Margaret). Two will have conflicts. */
const cellDataWithThreeTeachers = {
  ...baseCellData,
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
    {
      id: 'a-3',
      teacher_id: 'teacher-3',
      teacher_name: 'Margaret O.',
      classroom_id: 'class-1',
      classroom_name: 'Infant Room',
    },
  ],
}

/** After "refresh", simulate server returning only one assignment (e.g. one resolved). */
const cellDataAfterRefreshOneAssignment = {
  ...baseCellData,
  assignments: [
    {
      id: 'a-1-resolved',
      teacher_id: 'teacher-1',
      teacher_name: 'Bella W.',
      classroom_id: 'class-1',
      classroom_name: 'Infant Room',
      is_floater: true,
    },
  ],
}

type SetupFetchOptions = {
  checkConflictsResponse?: { conflicts: unknown[] }
}

const setupFetch = (options?: SetupFetchOptions) => {
  const checkConflictsResponse = options?.checkConflictsResponse ?? { conflicts: [] }

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
      return {
        ok: true,
        json: async () => checkConflictsResponse,
      } as Response
    }
    // Resolve-conflict: delay so Apply handler is still awaiting when teacher fetch completes.
    // Teacher fetch completes at 100ms; resolve at 200ms. Preserve ref must be set at START of Apply
    // so the fetch .then() at 100ms sees it and skips overwriting.
    if (url.includes('/api/teacher-schedules/resolve-conflict')) {
      return {
        ok: true,
        json: () => new Promise(resolve => setTimeout(() => resolve({}), 200)),
      } as Response
    }
    // Teacher-schedules list: complete at 100ms (during resolve-conflict wait). Return 1 teacher
    // so without the guard the .then() would overwrite and drop 2 teachers.
    if (
      url.includes('/api/teacher-schedules') &&
      !url.includes('resolve-conflict') &&
      !url.includes('check-conflicts')
    ) {
      return {
        ok: true,
        json: () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve([
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
                ]),
              100
            )
          ),
      } as Response
    }
    if (url.includes('/api/schedule-cells?')) {
      return { ok: true, json: async () => [] } as Response
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
    return { ok: true, json: async () => ({}) } as Response
  }) as jest.Mock
}

describe('ScheduleSidePanel conflict resolution', () => {
  jest.setTimeout(10000)

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('preserves all three selected teachers when resolving two conflicts as floaters and Apply (preserve ref set at start so in-flight fetch during resolve-conflict skips overwrite)', async () => {
    setupFetch({
      checkConflictsResponse: {
        conflicts: [
          {
            teacher_id: 'teacher-1',
            teacher_name: 'Bella W.',
            conflicting_schedule_id: 'ts-other-1',
            conflicting_classroom_id: 'class-other',
            conflicting_classroom_name: 'Toddler B Room',
            day_of_week_id: 'day-1',
            day_of_week_name: 'Monday',
            time_slot_id: 'slot-1',
            time_slot_code: 'LB1',
            target_classroom_id: 'class-1',
            conflicting_role_label: 'Permanent teacher',
          },
          {
            teacher_id: 'teacher-2',
            teacher_name: 'Amy P.',
            conflicting_schedule_id: 'ts-other-2',
            conflicting_classroom_id: 'class-other',
            conflicting_classroom_name: 'Toddler B Room',
            day_of_week_id: 'day-1',
            day_of_week_name: 'Monday',
            time_slot_id: 'slot-1',
            time_slot_code: 'LB1',
            target_classroom_id: 'class-1',
            conflicting_role_label: 'Flex teacher',
          },
        ],
      },
    })

    const baseProps = {
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
      readOnly: false,
    }

    const PanelWrapper = () => {
      const [selectedCellData, setSelectedCellData] = useState(cellDataWithThreeTeachers)
      const onRefresh = useCallback(() => {
        setSelectedCellData(cellDataAfterRefreshOneAssignment)
      }, [])

      return (
        <ScheduleSidePanel
          {...baseProps}
          selectedCellData={selectedCellData}
          onRefresh={onRefresh}
        />
      )
    }

    render(<PanelWrapper />)

    // Wait for panel to show staffing summary with 3 scheduled (from initial selectedCellData)
    await waitFor(
      () => {
        expect(screen.getByText(/Scheduled: 3/)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Conflict check runs; real ConflictBanner appears
    await waitFor(
      () => {
        expect(screen.getByText('Scheduling Conflicts Detected')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Select "Keep both — Mark as Floater" for both conflicts (radios have id ts-other-1-mark_floater, ts-other-2-mark_floater)
    const markFloater1 = document.getElementById('ts-other-1-mark_floater')
    const markFloater2 = document.getElementById('ts-other-2-mark_floater')
    expect(markFloater1).toBeInTheDocument()
    expect(markFloater2).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(markFloater1!)
      fireEvent.click(markFloater2!)
    })

    // Click Apply selection
    const applyButton = screen.getByRole('button', { name: /apply selection/i })
    await act(async () => {
      fireEvent.click(applyButton)
    })

    // Wait for resolve-conflict to be called (Apply started)
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/teacher-schedules/resolve-conflict'),
          expect.any(Object)
        )
      },
      { timeout: 3000 }
    )

    // Teacher fetch completes at 100ms (during resolve-conflict 200ms delay). Preserve ref is set at
    // START of Apply, so .then() at 100ms skips overwrite. Wait for resolve-conflict and effects to settle.
    await act(async () => {
      await new Promise(r => setTimeout(r, 350))
    })

    // Preservation: panel must still show 3 scheduled. If the preserve ref were set at the end of Apply
    // (after await resolve-conflict), the fetch .then() at 100ms would overwrite with 1 teacher.
    expect(screen.getByText(/Scheduled: 3/)).toBeInTheDocument()
    expect(screen.queryByText(/Scheduled: 1/)).not.toBeInTheDocument()
  })
})
