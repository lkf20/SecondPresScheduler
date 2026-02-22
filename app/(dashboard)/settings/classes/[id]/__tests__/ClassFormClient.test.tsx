/* eslint-disable react/display-name */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ClassFormClient from '@/app/(dashboard)/settings/classes/[id]/ClassFormClient'

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
    <input ref={ref} {...props} value={props.value ?? undefined} />
  )),
}))

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
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

const originalFetch = global.fetch

describe('ClassFormClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }) as Response) as jest.Mock
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('submits class updates and normalizes optional number fields to null', async () => {
    render(
      <ClassFormClient
        classData={
          {
            id: 'cg-1',
            name: 'Infant A',
            min_age: 1,
            max_age: 2,
            required_ratio: 4,
            preferred_ratio: 3,
            diaper_changing_required: false,
            lifting_children_required: false,
            toileting_assistance_required: false,
            is_active: true,
          } as never
        }
      />
    )

    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/class-groups/cg-1',
        expect.objectContaining({
          method: 'PUT',
        })
      )
    })

    const request = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(JSON.parse(request.body)).toMatchObject({
      name: 'Infant A',
      preferred_ratio: null,
      min_age: 1,
      max_age: 2,
      required_ratio: 4,
    })
    expect(pushMock).toHaveBeenCalledWith('/settings/classes')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('shows backend error message when update fails', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        json: async () => ({ error: 'Failed to update class group' }),
      } as Response
    }) as jest.Mock

    render(
      <ClassFormClient
        classData={
          {
            id: 'cg-1',
            name: 'Infant A',
            required_ratio: 4,
            is_active: true,
          } as never
        }
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    expect(await screen.findByText('Failed to update class group')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
