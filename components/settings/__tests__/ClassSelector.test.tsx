import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ClassSelector from '@/components/settings/ClassSelector'

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={e => onCheckedChange?.(e.target.checked)}
      aria-label={id || 'Class checkbox'}
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
const openClassList = () => {
  const toggleButton = screen.getByRole('button', {
    name: /expand class groups list|collapse class groups list/i,
  })
  if ((toggleButton.getAttribute('aria-label') || '').toLowerCase().includes('expand')) {
    fireEvent.click(toggleButton)
  }
}
const waitForClassGroupCheckbox = async (id = 'class-group-cg-1') => {
  openClassList()
  await screen.findByLabelText(id)
}

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
      expect(screen.getByPlaceholderText('Search class groups...')).toBeInTheDocument()
    })
    await waitForClassGroupCheckbox()
    fireEvent.click(screen.getByLabelText('class-group-cg-1'))

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

    await waitForClassGroupCheckbox()
    fireEvent.change(screen.getByPlaceholderText('Search class groups...'), {
      target: { value: 'NoMatch' },
    })

    expect(screen.getByText('No class groups found')).toBeInTheDocument()
  })

  it('supports remove chip and select-all/clear-all dialog actions', async () => {
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

    render(<ClassSelector selectedClassIds={['cg-1']} onSelectionChange={onSelectionChange} />)

    expect(await screen.findByText('Infant A')).toBeInTheDocument()
    const chip = screen.getByText('Infant A').closest('div')
    const removeButton = chip?.querySelector('button')
    expect(removeButton).toBeTruthy()
    fireEvent.click(removeButton as HTMLButtonElement)
    expect(onSelectionChange).toHaveBeenCalledWith([])
  })

  it('supports select-all and deselect-all actions in the expanded list', async () => {
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

    await waitForClassGroupCheckbox()
    fireEvent.click(screen.getByRole('button', { name: /^select all$/i }))
    expect(onSelectionChange).toHaveBeenCalledWith(expect.arrayContaining(['cg-1', 'cg-2']))
    fireEvent.change(screen.getByPlaceholderText('Search class groups...'), {
      target: { value: 'Toddler' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^deselect all$/i }))
    expect(onSelectionChange).toHaveBeenCalledWith(expect.not.arrayContaining(['cg-2']))
  })

  it('deselects via checkbox onCheckedChange and saves empty selection', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => [{ id: 'cg-1', name: 'Infant A' }],
      } as Response
    }) as jest.Mock

    render(<ClassSelector selectedClassIds={['cg-1']} onSelectionChange={onSelectionChange} />)

    await waitForClassGroupCheckbox()
    const checkbox = screen.getByLabelText('class-group-cg-1')
    fireEvent.click(checkbox)

    expect(onSelectionChange).toHaveBeenCalledWith([])
  })

  it('handles class-group fetch failure gracefully', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn(async () => {
      throw new Error('fetch failed')
    }) as jest.Mock

    render(<ClassSelector selectedClassIds={[]} onSelectionChange={jest.fn()} />)

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled()
    })

    openClassList()
    expect(screen.getByText('No class groups found')).toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('syncs selectedIds when selectedClassIds prop changes', async () => {
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

    const { rerender } = render(
      <ClassSelector selectedClassIds={['cg-1']} onSelectionChange={onSelectionChange} />
    )

    expect(await screen.findByText('Infant A')).toBeInTheDocument()
    expect(screen.queryByText('Toddler B')).not.toBeInTheDocument()

    rerender(<ClassSelector selectedClassIds={['cg-2']} onSelectionChange={onSelectionChange} />)

    expect(await screen.findByText('Toddler B')).toBeInTheDocument()
    expect(screen.queryByText('Infant A')).not.toBeInTheDocument()

    await waitForClassGroupCheckbox('class-group-cg-2')
    fireEvent.click(screen.getByLabelText('class-group-cg-2'))

    expect(onSelectionChange).toHaveBeenLastCalledWith([])
  })
})
