/* eslint-disable react/display-name */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ClassroomFormClient from '@/app/(dashboard)/settings/classrooms/[id]/ClassroomFormClient'

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

jest.mock('@/components/settings/ClassSelector', () => ({
  __esModule: true,
  default: ({
    selectedClassIds,
    onSelectionChange,
  }: {
    selectedClassIds: string[]
    onSelectionChange: (ids: string[]) => void
  }) => (
    <div>
      <div data-testid="selected-classes">{selectedClassIds.join(',')}</div>
      <button type="button" onClick={() => onSelectionChange(['cg-2'])}>
        Select Toddler B
      </button>
    </div>
  ),
}))

jest.mock('@/components/settings/ClassroomColorPicker', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (color: string | null) => void }) => (
    <button type="button" onClick={() => onChange('#AABBCC')}>
      Pick Color
    </button>
  ),
}))

const originalFetch = global.fetch

describe('ClassroomFormClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/allowed-classes')) {
        return { ok: true, json: async () => ['cg-1'] } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    }) as jest.Mock
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('loads allowed classes and submits updates with selected classes and color', async () => {
    render(
      <ClassroomFormClient
        classroom={
          {
            id: 'class-1',
            name: 'Infant Room',
            capacity: 10,
            is_active: true,
            color: null,
          } as never
        }
      />
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/classrooms/class-1/allowed-classes')
    })

    fireEvent.click(screen.getByRole('button', { name: /pick color/i }))
    fireEvent.click(screen.getByRole('button', { name: /select toddler b/i }))
    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/classrooms/class-1',
        expect.objectContaining({ method: 'PUT' })
      )
    })

    const putCall = (global.fetch as jest.Mock).mock.calls.find(
      call => call[0] === '/api/classrooms/class-1'
    )
    const body = JSON.parse(putCall[1].body)
    expect(body).toMatchObject({
      name: 'Infant Room',
      capacity: 12,
      allowed_class_group_ids: ['cg-2'],
      color: '#AABBCC',
      is_active: true,
    })

    expect(pushMock).toHaveBeenCalledWith('/settings/classrooms')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('shows an error when update fails', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/allowed-classes')) {
        return { ok: true, json: async () => [] } as Response
      }
      return {
        ok: false,
        json: async () => ({ error: 'Failed to update classroom' }),
      } as Response
    }) as jest.Mock

    render(
      <ClassroomFormClient
        classroom={
          {
            id: 'class-1',
            name: 'Infant Room',
            capacity: 10,
            is_active: true,
            color: null,
          } as never
        }
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    expect(await screen.findByText('Failed to update classroom')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
