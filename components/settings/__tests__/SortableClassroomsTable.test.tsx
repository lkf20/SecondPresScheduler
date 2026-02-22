import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SortableClassroomsTable from '@/components/settings/SortableClassroomsTable'

let dragEvent: { active: { id: string }; over: { id: string } | null } | null = null

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
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
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const clone = [...items]
    const [moved] = clone.splice(from, 1)
    clone.splice(to, 0, moved)
    return clone
  },
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
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

describe('SortableClassroomsTable', () => {
  const originalFetch = global.fetch
  const originalAlert = global.alert

  const classrooms = [
    {
      id: 'class-1',
      name: 'Infant Room',
      capacity: 10,
      allowed_classes_display: 'Infant A',
      is_active: true,
      color: '#AABBCC',
    },
    {
      id: 'class-2',
      name: 'Toddler Room',
      capacity: null,
      allowed_classes_display: '',
      is_active: false,
      color: null,
    },
  ]

  beforeEach(() => {
    dragEvent = null
    jest.clearAllMocks()
    global.fetch = jest.fn(async () => ({ ok: true }) as Response) as jest.Mock
    global.alert = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
    global.alert = originalAlert
  })

  it('filters by search, toggles inactive rows, and shows fallback content', async () => {
    render(<SortableClassroomsTable classrooms={classrooms} />)

    expect(screen.getByText('Infant Room')).toBeInTheDocument()
    expect(screen.queryByText('Toddler Room')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('show-inactive'))
    expect(await screen.findByText('Toddler Room')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search classrooms...'), {
      target: { value: 'Toddler' },
    })
    expect(screen.queryByText('Infant Room')).not.toBeInTheDocument()
    expect(screen.getByText('Toddler Room')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('persists classroom order changes after drag end', async () => {
    dragEvent = { active: { id: 'class-1' }, over: { id: 'class-2' } }
    render(<SortableClassroomsTable classrooms={classrooms} />)

    fireEvent.click(screen.getByRole('button', { name: /trigger drag end/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/classrooms/class-1',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/classrooms/class-2',
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('shows alert and reverts when classroom order save fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    dragEvent = { active: { id: 'class-1' }, over: { id: 'class-2' } }
    global.fetch = jest.fn(async () => {
      throw new Error('save failed')
    }) as jest.Mock

    render(<SortableClassroomsTable classrooms={classrooms} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger drag end/i }))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to save order. Please try again.')
    })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
