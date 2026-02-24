import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SortableClassesTable from '@/components/settings/SortableClassesTable'

let dragEvent: { active: { id: string }; over: { id: string } | null } | null = null
let mockIsDragging = false
const arrayMoveMock = jest.fn(<T,>(items: T[], from: number, to: number) => {
  const clone = [...items]
  const [moved] = clone.splice(from, 1)
  clone.splice(to, 0, moved)
  return clone
})

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}))

jest.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          if (dragEvent && onDragEnd) onDragEnd(dragEvent)
        }}
      >
        Trigger Drag End
      </button>
      {children}
    </div>
  ),
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(() => ({})),
  useSensors: jest.fn(() => []),
}))

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(items: T[], from: number, to: number) => arrayMoveMock(items, from, to),
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: undefined,
    isDragging: mockIsDragging,
  }),
  verticalListSortingStrategy: jest.fn(),
}))

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}))

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id: string
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      id={id}
      aria-label="show-inactive"
      type="checkbox"
      checked={checked}
      onChange={event => onCheckedChange?.(event.target.checked)}
    />
  ),
}))

describe('SortableClassesTable', () => {
  const originalFetch = global.fetch
  const originalAlert = global.alert

  const classes = [
    { id: 'cg-1', name: 'Infant A', order: 1, is_active: true },
    { id: 'cg-2', name: 'Toddler B', order: 2, is_active: false },
  ]

  beforeEach(() => {
    dragEvent = null
    mockIsDragging = false
    arrayMoveMock.mockImplementation(<T,>(items: T[], from: number, to: number) => {
      const clone = [...items]
      const [moved] = clone.splice(from, 1)
      clone.splice(to, 0, moved)
      return clone
    })
    jest.clearAllMocks()
    global.fetch = jest.fn(async () => ({ ok: true }) as Response) as jest.Mock
    global.alert = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
    global.alert = originalAlert
  })

  it('filters by search and hides inactive rows until toggled', async () => {
    render(<SortableClassesTable classes={classes} />)

    expect(screen.getByText('Infant A')).toBeInTheDocument()
    expect(screen.queryByText('Toddler B')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('show-inactive'))
    expect(await screen.findByText('Toddler B')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search class groups...'), {
      target: { value: 'No Match' },
    })
    expect(screen.getByText('No classes found')).toBeInTheDocument()
  })

  it('persists order changes after drag end', async () => {
    dragEvent = { active: { id: 'cg-1' }, over: { id: 'cg-2' } }
    render(<SortableClassesTable classes={classes} />)

    fireEvent.click(screen.getByRole('button', { name: /trigger drag end/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/class-groups/cg-1',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/class-groups/cg-2',
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('does nothing when drag ends on same item', async () => {
    dragEvent = { active: { id: 'cg-1' }, over: { id: 'cg-1' } }
    render(<SortableClassesTable classes={classes} />)

    fireEvent.click(screen.getByRole('button', { name: /trigger drag end/i }))

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  it('does nothing when drag ends without an over target', async () => {
    dragEvent = { active: { id: 'cg-1' }, over: null }
    render(<SortableClassesTable classes={classes} />)

    fireEvent.click(screen.getByRole('button', { name: /trigger drag end/i }))

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  it('skips save when computed order is unchanged', async () => {
    arrayMoveMock.mockImplementation(<T,>(items: T[]) => items)
    dragEvent = { active: { id: 'cg-1' }, over: { id: 'cg-2' } }
    const orderedClasses = [
      { id: 'cg-1', name: 'Infant A', order: 1, is_active: true },
      { id: 'cg-2', name: 'Toddler B', order: 2, is_active: true },
    ]

    render(<SortableClassesTable classes={orderedClasses} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger drag end/i }))

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  it('applies dragging row styles when an item is dragging', () => {
    mockIsDragging = true
    render(<SortableClassesTable classes={classes} />)

    const row = screen.getByText('Infant A').closest('tr')
    expect(row).toHaveClass('bg-muted')
    expect(row).toHaveStyle({ opacity: '0.5' })
  })

  it('reverts and alerts when order save fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    dragEvent = { active: { id: 'cg-1' }, over: { id: 'cg-2' } }
    global.fetch = jest.fn(async () => {
      throw new Error('save failed')
    }) as jest.Mock

    render(<SortableClassesTable classes={classes} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger drag end/i }))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to save order. Please try again.')
    })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
