/* eslint-disable react/display-name */
import { fireEvent, render, screen } from '@testing-library/react'
import SortableClassesTable from '@/components/settings/SortableClassesTable'

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

describe('SortableClassesTable', () => {
  const classes = [
    { id: 'cg-1', name: 'Infant A', order: 1, is_active: true },
    { id: 'cg-2', name: 'Toddler B', order: 2, is_active: false },
  ]

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
})
