/* eslint-disable react/display-name */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TimeSlotForm from '@/components/settings/TimeSlotForm'

const pushMock = jest.fn()
const refreshMock = jest.fn()
const invalidateQueriesMock = jest.fn().mockResolvedValue(undefined)

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}))

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
}))

jest.mock('@/lib/utils/invalidation', () => ({
  invalidateWeeklySchedule: jest.fn().mockResolvedValue(undefined),
  invalidateDailySchedule: jest.fn().mockResolvedValue(undefined),
  invalidateDashboard: jest.fn().mockResolvedValue(undefined),
  invalidateTimeOffRequests: jest.fn().mockResolvedValue(undefined),
  invalidateSubFinderAbsences: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    type,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    type?: 'button' | 'submit' | 'reset'
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>((props, ref) => (
    <input
      ref={ref}
      {...props}
      aria-label={props.placeholder || 'input'}
      value={props.value ?? undefined}
    />
  )),
}))

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    id?: string
  }) => (
    <input
      id={id}
      aria-label={id}
      type="checkbox"
      checked={checked}
      onChange={event => onCheckedChange?.(event.target.checked)}
    />
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/shared/FormField', () => ({
  __esModule: true,
  default: ({
    label,
    children,
    error,
  }: {
    label: string
    children: React.ReactNode
    error?: string
  }) => (
    <div>
      <label>{label}</label>
      {children}
      {error ? <p>{error}</p> : null}
    </div>
  ),
}))

jest.mock('@/components/shared/ErrorMessage', () => ({
  __esModule: true,
  default: ({ message }: { message: string }) => <p>{message}</p>,
}))

jest.mock('@/components/staff/StaffUnsavedChangesDialog', () => ({
  __esModule: true,
  default: () => null,
}))

const originalFetch = global.fetch

describe('TimeSlotForm (edit)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(
      async () => ({ ok: true, json: async () => ({}) }) as Response
    ) as jest.Mock
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('submits updates and normalizes optional text/time fields to null', async () => {
    render(
      <TimeSlotForm
        mode="edit"
        timeSlot={
          {
            id: 'slot-1',
            code: 'EM',
            name: 'Early Morning',
            default_start_time: '08:00:00',
            default_end_time: '10:00:00',
            is_active: true,
          } as never
        }
      />
    )

    fireEvent.change(screen.getByDisplayValue('Early Morning'), { target: { value: '' } })
    fireEvent.change(screen.getByDisplayValue('08:00'), { target: { value: '' } })
    fireEvent.change(screen.getByDisplayValue('10:00'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/timeslots/slot-1',
        expect.objectContaining({ method: 'PUT' })
      )
    })

    const putCall = (global.fetch as jest.Mock).mock.calls.find(
      call => call[0] === '/api/timeslots/slot-1'
    )
    expect(JSON.parse(putCall[1].body)).toMatchObject({
      code: 'EM',
      name: null,
      default_start_time: null,
      default_end_time: null,
      is_active: true,
    })
    const { toast } = await import('sonner')
    expect(toast.success).toHaveBeenCalledWith('EM updated.')
    expect(invalidateQueriesMock).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('/settings/timeslots')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('shows an error when update fails', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        json: async () => ({ error: 'Failed to update time slot' }),
      } as Response
    }) as jest.Mock

    render(
      <TimeSlotForm
        mode="edit"
        timeSlot={
          {
            id: 'slot-1',
            code: 'EM',
            name: 'Early Morning',
            is_active: true,
          } as never
        }
      />
    )

    fireEvent.change(screen.getByDisplayValue('Early Morning'), { target: { value: 'Late AM' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    expect(await screen.findByText('Failed to update time slot')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
