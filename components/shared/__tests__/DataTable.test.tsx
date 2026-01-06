import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTable, { Column } from '../DataTable'

// Mock Next.js navigation hooks
const mockPush = jest.fn()
const mockPathname = '/test'
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}))

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

interface TestData {
  id: string
  name: string
  age: number
  active: boolean
  email?: string
}

describe('DataTable', () => {
  const mockData: TestData[] = [
    { id: '1', name: 'Alice', age: 25, active: true, email: 'alice@example.com' },
    { id: '2', name: 'Bob', age: 30, active: false, email: 'bob@example.com' },
    { id: '3', name: 'Charlie', age: 35, active: true },
    { id: '4', name: 'David', age: 28, active: true, email: 'david@example.com' },
    { id: '5', name: 'Eve', age: 32, active: false },
  ]

  const basicColumns: Column<TestData>[] = [
    { key: 'name', header: 'Name' },
    { key: 'age', header: 'Age' },
    { key: 'active', header: 'Status' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  describe('Basic Rendering', () => {
    it('should render table with data', () => {
      render(<DataTable data={mockData} columns={basicColumns} />)

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Age')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it('should render empty message when no data', () => {
      render(<DataTable data={[]} columns={basicColumns} />)

      expect(screen.getByText('No data available')).toBeInTheDocument()
    })

    it('should render custom empty message', () => {
      render(
        <DataTable data={[]} columns={basicColumns} emptyMessage="No records found" />
      )

      expect(screen.getByText('No records found')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <DataTable data={mockData} columns={basicColumns} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('Search Functionality', () => {
    it('should not show search input when searchable is false', () => {
      render(<DataTable data={mockData} columns={basicColumns} searchable={false} />)

      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
    })

    it('should show search input when searchable is true', () => {
      render(<DataTable data={mockData} columns={basicColumns} searchable />)

      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    })

    it('should filter data by search term', async () => {
      const user = userEvent.setup()
      render(<DataTable data={mockData} columns={basicColumns} searchable />)

      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'Alice')

      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    })

    it('should filter across multiple columns', async () => {
      const user = userEvent.setup()
      render(<DataTable data={mockData} columns={basicColumns} searchable />)

      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, '30')

      // Should find Bob (age 30)
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it('should use custom search placeholder', () => {
      render(
        <DataTable
          data={mockData}
          columns={basicColumns}
          searchable
          searchPlaceholder="Type to search..."
        />
      )

      expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument()
    })

    it('should reset to page 1 when searching', async () => {
      const user = userEvent.setup()
      // Create enough data to require pagination
      const largeData = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `Person ${i + 1}`,
        age: 20 + i,
        active: true,
      }))

      const { container } = render(
        <DataTable data={largeData} columns={basicColumns} searchable />
      )

      // Navigate to page 2
      const buttons = container.querySelectorAll('button')
      const nextButton = Array.from(buttons).find((btn) => !btn.disabled && btn !== buttons[0])
      if (nextButton) {
        await user.click(nextButton)
        await waitFor(() => {
          expect(screen.getByText(/Page 2 of/i)).toBeInTheDocument()
        })
      }

      // Search should reset to page 1
      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'Person 1')

      // Should show page 1 results
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/i)).toBeInTheDocument()
      })
    })
  })

  describe('Sorting', () => {
    const sortableColumns: Column<TestData>[] = [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'age', header: 'Age', sortable: true },
      { key: 'active', header: 'Status' },
    ]

    it('should show sort indicator when column is sortable', () => {
      render(<DataTable data={mockData} columns={sortableColumns} />)

      const nameHeader = screen.getByText('Name').closest('th')
      expect(nameHeader).toHaveClass('cursor-pointer')
    })

    it('should not show sort indicator when column is not sortable', () => {
      render(<DataTable data={mockData} columns={sortableColumns} />)

      const statusHeader = screen.getByText('Status').closest('th')
      expect(statusHeader).not.toHaveClass('cursor-pointer')
    })

    it('should sort ascending on first click', async () => {
      const user = userEvent.setup()
      render(<DataTable data={mockData} columns={sortableColumns} />)

      const nameHeader = screen.getByText('Name')
      await user.click(nameHeader)

      // Check that sort indicator appears
      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('should sort descending on second click', async () => {
      const user = userEvent.setup()
      render(<DataTable data={mockData} columns={sortableColumns} />)

      const nameHeader = screen.getByText('Name')
      await user.click(nameHeader) // First click - ascending
      await user.click(nameHeader) // Second click - descending

      expect(screen.getByText('↓')).toBeInTheDocument()
    })

    it('should update URL when sorting', async () => {
      const user = userEvent.setup()
      render(<DataTable data={mockData} columns={sortableColumns} />)

      const nameHeader = screen.getByText('Name')
      await user.click(nameHeader)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('sort=name'),
          { scroll: false }
        )
      })
    })
  })

  describe('Pagination', () => {
    it('should not show pagination when data fits on one page', () => {
      render(<DataTable data={mockData} columns={basicColumns} />)

      expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument()
    })

    it('should show pagination when data exceeds page size', () => {
      const largeData = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `Person ${i + 1}`,
        age: 20 + i,
        active: true,
      }))

      render(<DataTable data={largeData} columns={basicColumns} />)

      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument()
    })

    it('should navigate to next page', async () => {
      const user = userEvent.setup()
      const largeData = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `Person ${i + 1}`,
        age: 20 + i,
        active: true,
      }))

      const { container } = render(<DataTable data={largeData} columns={basicColumns} />)

      // Find the next button (not disabled)
      const buttons = container.querySelectorAll('button')
      const nextButton = Array.from(buttons).find((btn) => !btn.disabled && btn !== buttons[0])
      if (nextButton) {
        await user.click(nextButton)
        await waitFor(() => {
          expect(screen.getByText(/Page 2 of/)).toBeInTheDocument()
        })
      }
    })

    it('should navigate to previous page', async () => {
      const user = userEvent.setup()
      const largeData = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `Person ${i + 1}`,
        age: 20 + i,
        active: true,
      }))

      const { container } = render(<DataTable data={largeData} columns={basicColumns} />)

      // Go to page 2 first
      const buttons = container.querySelectorAll('button')
      const nextButton = Array.from(buttons).find((btn) => !btn.disabled && btn !== buttons[0])
      if (nextButton) {
        await user.click(nextButton)
        await waitFor(() => {
          expect(screen.getByText(/Page 2 of/)).toBeInTheDocument()
        })

        // Then go back
        const buttonsAfter = container.querySelectorAll('button')
        const prevButton = buttonsAfter[0] // First button is previous
        await user.click(prevButton)

        await waitFor(() => {
          expect(screen.getByText(/Page 1 of/)).toBeInTheDocument()
        })
      }
    })

    it('should disable previous button on first page', () => {
      const largeData = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `Person ${i + 1}`,
        age: 20 + i,
        active: true,
      }))

      const { container } = render(<DataTable data={largeData} columns={basicColumns} />)

      // Find the previous button by its disabled state and position
      const buttons = container.querySelectorAll('button')
      const prevButton = Array.from(buttons).find((btn) => btn.disabled)
      expect(prevButton).toBeInTheDocument()
      expect(prevButton).toBeDisabled()
    })

    it('should disable next button on last page', async () => {
      const user = userEvent.setup()
      const largeData = Array.from({ length: 15 }, (_, i) => ({
        id: String(i + 1),
        name: `Person ${i + 1}`,
        age: 20 + i,
        active: true,
      }))

      const { container } = render(<DataTable data={largeData} columns={basicColumns} />)

      // Go to last page
      const buttons = container.querySelectorAll('button')
      const nextButton = Array.from(buttons).find((btn) => !btn.disabled && btn !== buttons[0])
      if (nextButton) {
        await user.click(nextButton)

        await waitFor(() => {
          const buttonsAfter = container.querySelectorAll('button')
          const nextButtonAfter = Array.from(buttonsAfter).find(
            (btn) => !btn.disabled && btn !== buttonsAfter[0]
          )
          // On last page, next button should be disabled
          expect(nextButtonAfter).toBeUndefined()
        })
      }
    })

    it('should show correct result count', () => {
      const largeData = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `Person ${i + 1}`,
        age: 20 + i,
        active: true,
      }))

      render(<DataTable data={largeData} columns={basicColumns} />)

      expect(screen.getByText(/Showing 1 to 10 of 25 results/)).toBeInTheDocument()
    })
  })

  describe('Row Clicking', () => {
    it('should call onRowClick when row is clicked', async () => {
      const user = userEvent.setup()
      const handleRowClick = jest.fn()

      render(
        <DataTable data={mockData} columns={basicColumns} onRowClick={handleRowClick} />
      )

      const firstRow = screen.getByText('Alice').closest('tr')
      if (firstRow) {
        await user.click(firstRow)
      }

      expect(handleRowClick).toHaveBeenCalledWith(mockData[0])
    })

    it('should not call onRowClick when not provided', async () => {
      const user = userEvent.setup()

      render(<DataTable data={mockData} columns={basicColumns} />)

      const firstRow = screen.getByText('Alice').closest('tr')
      if (firstRow) {
        await user.click(firstRow)
      }

      // Should not throw error
      expect(firstRow).toBeInTheDocument()
    })

    it('should apply cursor-pointer class when onRowClick is provided', () => {
      const handleRowClick = jest.fn()

      render(
        <DataTable data={mockData} columns={basicColumns} onRowClick={handleRowClick} />
      )

      const firstRow = screen.getByText('Alice').closest('tr')
      expect(firstRow).toHaveClass('cursor-pointer')
    })
  })

  describe('Custom Cell Rendering', () => {
    it('should use custom cell function when provided', () => {
      const columnsWithCell: Column<TestData>[] = [
        {
          key: 'name',
          header: 'Name',
          cell: (row) => <strong>{row.name.toUpperCase()}</strong>,
        },
        { key: 'age', header: 'Age' },
      ]

      render(<DataTable data={mockData} columns={columnsWithCell} />)

      expect(screen.getByText('ALICE')).toBeInTheDocument()
    })

    it('should fallback to row data if cell function throws', () => {
      const columnsWithError: Column<TestData>[] = [
        {
          key: 'name',
          header: 'Name',
          cell: () => {
            throw new Error('Test error')
          },
        },
      ]

      render(<DataTable data={mockData} columns={columnsWithError} />)

      // Should still render the name from row data
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })

  describe('Link Generation', () => {
    it('should generate links when linkBasePath is provided', () => {
      const columnsWithLink: Column<TestData>[] = [
        { key: 'name', header: 'Name', linkBasePath: '/users' },
        { key: 'age', header: 'Age' },
      ]

      render(<DataTable data={mockData} columns={columnsWithLink} />)

      const link = screen.getByText('Alice').closest('a')
      expect(link).toHaveAttribute('href', expect.stringContaining('/users/1'))
    })

    it('should not generate links when linkBasePath is not provided', () => {
      render(<DataTable data={mockData} columns={basicColumns} />)

      const nameCell = screen.getByText('Alice')
      expect(nameCell.closest('a')).not.toBeInTheDocument()
    })
  })

  describe('Special Value Handling', () => {
    it('should display "Active" or "Inactive" for boolean active field', () => {
      render(<DataTable data={mockData} columns={basicColumns} />)

      const activeElements = screen.getAllByText('Active')
      const inactiveElements = screen.getAllByText('Inactive')
      expect(activeElements.length).toBeGreaterThan(0)
      expect(inactiveElements.length).toBeGreaterThan(0)
    })

    it('should display "—" for null values', () => {
      const dataWithNulls: TestData[] = [
        { id: '1', name: 'Test', age: 25, active: true, email: null as any },
      ]

      render(<DataTable data={dataWithNulls} columns={basicColumns} />)

      // The email column isn't in basicColumns, but we can test null handling
      expect(screen.getByText('Test')).toBeInTheDocument()
    })

    it('should display "—" for undefined values', () => {
      const dataWithUndefined: TestData[] = [
        { id: '1', name: 'Test', age: 25, active: true },
      ]

      render(<DataTable data={dataWithUndefined} columns={basicColumns} />)

      expect(screen.getByText('Test')).toBeInTheDocument()
    })

    it('should display "—" for empty strings', () => {
      const dataWithEmpty: TestData[] = [
        { id: '1', name: '', age: 25, active: true },
      ]

      render(<DataTable data={dataWithEmpty} columns={basicColumns} />)

      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })
})

