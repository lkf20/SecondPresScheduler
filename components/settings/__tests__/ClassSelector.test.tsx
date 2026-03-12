import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ClassSelector from '@/components/settings/ClassSelector'

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    className?: string
  }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-popover-open={open}>{children}</div>
  ),
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-popover-trigger>{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const originalFetch = global.fetch

const mockClassGroups = [
  { id: 'cg-1', name: 'Infant A', order: 1, is_active: true },
  { id: 'cg-2', name: 'Toddler B', order: 2, is_active: true },
]

describe('ClassSelector', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('shows Add class group dropdown and adds class group on click', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => mockClassGroups,
    })) as jest.Mock

    render(<ClassSelector selectedClassIds={[]} onSelectionChange={onSelectionChange} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add class group/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /add class group/i }))
    await waitFor(() => {
      expect(screen.getByText('Infant A')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Infant A'))

    expect(onSelectionChange).toHaveBeenCalledWith(['cg-1'])
  })

  it('shows selected class groups as chips and removes on X click', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => mockClassGroups,
    })) as jest.Mock

    render(<ClassSelector selectedClassIds={['cg-1']} onSelectionChange={onSelectionChange} />)

    expect(await screen.findByText('Infant A')).toBeInTheDocument()
    const removeButton = screen.getByLabelText('Remove Infant A')
    fireEvent.click(removeButton)
    expect(onSelectionChange).toHaveBeenCalledWith([])
  })

  it('shows All selected when all class groups are selected and disables dropdown', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => mockClassGroups,
    })) as jest.Mock

    render(
      <ClassSelector selectedClassIds={['cg-1', 'cg-2']} onSelectionChange={onSelectionChange} />
    )

    await waitFor(() => {
      expect(screen.getByText('Infant A')).toBeInTheDocument()
      expect(screen.getByText('Toddler B')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /add class group/i })).not.toBeInTheDocument()
  })

  it('filters by allowedClassGroupIds when provided', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => mockClassGroups,
    })) as jest.Mock

    render(
      <ClassSelector
        selectedClassIds={[]}
        onSelectionChange={onSelectionChange}
        allowedClassGroupIds={['cg-1']}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add class group/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /add class group/i }))
    await waitFor(() => {
      expect(screen.getByText('Infant A')).toBeInTheDocument()
      expect(screen.queryByText('Toddler B')).not.toBeInTheDocument()
    })
    expect(
      screen.getByText(content =>
        content.includes('Showing only class groups allowed in this classroom')
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Settings → Classrooms/i })).toHaveAttribute(
      'href',
      '/settings/classrooms'
    )
  })

  it('handles fetch failure gracefully', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn(async () => {
      throw new Error('fetch failed')
    }) as jest.Mock

    render(<ClassSelector selectedClassIds={[]} onSelectionChange={jest.fn()} />)

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled()
    })
    // Dropdown stays visible so user can retry; list will be empty when opened
    expect(screen.getByRole('button', { name: /add class group/i })).toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('syncs chips when selectedClassIds prop changes', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => mockClassGroups,
    })) as jest.Mock

    const { rerender } = render(
      <ClassSelector selectedClassIds={['cg-1']} onSelectionChange={onSelectionChange} />
    )

    expect(await screen.findByLabelText('Remove Infant A')).toBeInTheDocument()
    expect(screen.queryByLabelText('Remove Toddler B')).not.toBeInTheDocument()

    rerender(<ClassSelector selectedClassIds={['cg-2']} onSelectionChange={onSelectionChange} />)

    expect(await screen.findByLabelText('Remove Toddler B')).toBeInTheDocument()
    expect(screen.queryByLabelText('Remove Infant A')).not.toBeInTheDocument()
  })
})
