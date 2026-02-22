import { fireEvent, render, screen } from '@testing-library/react'
import SortableClassroomsTable from '@/components/settings/SortableClassroomsTable'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(() => ({})),
  useSensors: jest.fn(() => []),
}))

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(items: T[]) => items,
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
})
