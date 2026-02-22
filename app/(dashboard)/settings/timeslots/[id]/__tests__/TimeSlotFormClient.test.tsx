/* eslint-disable react/display-name */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TimeSlotFormClient from '@/app/(dashboard)/settings/timeslots/[id]/TimeSlotFormClient'

const pushMock = jest.fn()
const refreshMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
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

const originalFetch = global.fetch
const originalConfirm = global.confirm

describe('TimeSlotFormClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(
      async () => ({ ok: true, json: async () => ({}) }) as Response
    ) as jest.Mock
    global.confirm = jest.fn(() => true)
  })

  afterAll(() => {
    global.fetch = originalFetch
    global.confirm = originalConfirm
  })

  it('submits updates and normalizes optional text/time fields to null', async () => {
    render(
      <TimeSlotFormClient
        timeslot={
          {
            id: 'slot-1',
            code: 'EM',
            name: 'Early Morning',
            default_start_time: '08:00:00',
            default_end_time: '10:00:00',
            display_order: 1,
          } as never
        }
      />
    )

    fireEvent.change(screen.getByDisplayValue('Early Morning'), { target: { value: '' } })
    fireEvent.change(screen.getByDisplayValue('08:00:00'), { target: { value: '' } })
    fireEvent.change(screen.getByDisplayValue('10:00:00'), { target: { value: '' } })
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
      display_order: 1,
    })
    expect(pushMock).toHaveBeenCalledWith('/settings/timeslots')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('deletes after confirmation and navigates back', async () => {
    render(
      <TimeSlotFormClient
        timeslot={
          {
            id: 'slot-1',
            code: 'EM',
            name: 'Early Morning',
            display_order: 1,
          } as never
        }
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /delete time slot/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/timeslots/slot-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
    expect(pushMock).toHaveBeenCalledWith('/settings/timeslots')
  })

  it('does not delete when confirmation is canceled', async () => {
    global.confirm = jest.fn(() => false)

    render(
      <TimeSlotFormClient
        timeslot={
          {
            id: 'slot-1',
            code: 'EM',
            name: 'Early Morning',
            display_order: 1,
          } as never
        }
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /delete time slot/i }))

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/timeslots/slot-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })
})
