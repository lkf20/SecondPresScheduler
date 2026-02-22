import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DaySelector from '@/components/settings/DaySelector'

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
    />
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

const originalFetch = global.fetch

describe('DaySelector', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('loads days sorted by day_number and defaults to weekdays when nothing selected', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => [
          { id: 'sun', name: 'Sunday', day_number: 7 },
          { id: 'wed', name: 'Wednesday', day_number: 3 },
          { id: 'mon', name: 'Monday', day_number: 1 },
          { id: 'fri', name: 'Friday', day_number: 5 },
          { id: 'sat', name: 'Saturday', day_number: 6 },
          { id: 'tue', name: 'Tuesday', day_number: 2 },
          { id: 'thu', name: 'Thursday', day_number: 4 },
        ],
      } as Response
    }) as jest.Mock

    render(<DaySelector selectedDayIds={[]} onSelectionChange={onSelectionChange} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading days...')).not.toBeInTheDocument()
    })
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    expect(screen.getAllByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/)).toHaveLength(7)
    expect(onSelectionChange).toHaveBeenCalledWith(['mon', 'tue', 'wed', 'thu', 'fri'])
  })

  it('toggles selections through checkbox interactions', async () => {
    const onSelectionChange = jest.fn()
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => [
          { id: 'mon', name: 'Monday', day_number: 1 },
          { id: 'tue', name: 'Tuesday', day_number: 2 },
        ],
      } as Response
    }) as jest.Mock

    render(<DaySelector selectedDayIds={['mon']} onSelectionChange={onSelectionChange} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading days...')).not.toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    expect(onSelectionChange).toHaveBeenCalledWith(['mon', 'tue'])
  })
})
