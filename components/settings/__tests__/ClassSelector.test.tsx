/* eslint-disable react/display-name */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ClassSelector from '@/components/settings/ClassSelector'

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onCheckedChange?.(e.target.checked)}
      aria-label="Class checkbox"
    />
  ),
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    className?: string
  }) => <input value={value} onChange={onChange} placeholder={placeholder} className={className} />,
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    type?: 'button' | 'submit' | 'reset'
    className?: string
  }) => (
    <button type={type || 'button'} onClick={onClick} className={className}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const originalFetch = global.fetch

describe('ClassSelector', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('opens dialog, selects class group, and saves selection', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => [
          { id: 'cg-1', name: 'Infant A' },
          { id: 'cg-2', name: 'Toddler B' },
        ],
      } as Response
    }) as jest.Mock

    render(<ClassSelector selectedClassIds={[]} onSelectionChange={onSelectionChange} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add class groups/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /add class groups/i }))
    expect(screen.getByText('Select Class Groups')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Infant A'))
    fireEvent.click(screen.getByRole('button', { name: /save \(1 selected\)/i }))

    expect(onSelectionChange).toHaveBeenCalledWith(['cg-1'])
  })

  it('filters classes by search query and shows empty state', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => [{ id: 'cg-1', name: 'Infant A' }],
      } as Response
    }) as jest.Mock

    render(<ClassSelector selectedClassIds={[]} onSelectionChange={onSelectionChange} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add class groups/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /add class groups/i }))
    fireEvent.change(screen.getByPlaceholderText('Search class groups...'), {
      target: { value: 'NoMatch' },
    })

    expect(screen.getByText('No class groups found')).toBeInTheDocument()
  })
})
