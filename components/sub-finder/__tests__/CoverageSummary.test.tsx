import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CoverageSummary from '@/components/sub-finder/CoverageSummary'

jest.mock('@/components/sub-finder/ShiftChips', () => ({
  formatShiftLabel: (date: string, code: string) => `${date} ${code}`,
}))

jest.mock('@/components/shared/CoverageBadge', () => {
  const MockCoverageBadge = ({ type, count }: { type: string; count: number }) => (
    <span>{`${type}:${count}`}</span>
  )
  MockCoverageBadge.displayName = 'MockCoverageBadge'
  return MockCoverageBadge
})

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('CoverageSummary', () => {
  it('returns null when there are no shifts', () => {
    const { container } = render(
      <CoverageSummary
        shifts={{
          total: 0,
          uncovered: 0,
          partially_covered: 0,
          fully_covered: 0,
          shift_details: [],
        }}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders full summary and supports clicking covered shifts', async () => {
    const user = userEvent.setup()
    const onShiftClick = jest.fn()
    const shifts = {
      total: 2,
      uncovered: 1,
      partially_covered: 0,
      fully_covered: 1,
      shift_details: [
        {
          id: 'shift-1',
          date: '2026-02-10',
          day_name: 'Tuesday',
          time_slot_code: 'EM',
          status: 'fully_covered' as const,
          sub_name: 'Sally A.',
        },
        {
          id: 'shift-2',
          date: '2026-02-10',
          day_name: 'Tuesday',
          time_slot_code: 'AM',
          status: 'uncovered' as const,
        },
      ],
    }

    render(<CoverageSummary shifts={shifts} onShiftClick={onShiftClick} />)

    expect(screen.getByText('1 of 2 shifts need coverage')).toBeInTheDocument()
    expect(screen.getByText(/1 shift covered by sally a\./i)).toBeInTheDocument()
    expect(screen.getByText('covered:1')).toBeInTheDocument()
    expect(screen.getByText('uncovered:1')).toBeInTheDocument()

    await user.click(screen.getByText('Sally A.', { selector: 'span.font-bold' }))
    expect(onShiftClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'shift-1' }))
  })

  it('renders partial badge text with sub names and partial time windows', () => {
    render(
      <CoverageSummary
        shifts={{
          total: 1,
          uncovered: 0,
          partially_covered: 1,
          fully_covered: 0,
          shift_details: [
            {
              id: 'shift-partial-1',
              date: '2026-02-10',
              day_name: 'Tuesday',
              time_slot_code: 'EM',
              status: 'partially_covered',
              sub_names: ['Victoria I.'],
              partial_time_windows: ['08:00-10:30'],
            },
          ],
        }}
      />
    )

    expect(screen.getByText(/Victoria I\./i)).toBeInTheDocument()
    expect(screen.getByText(/08:00-10:30/i)).toBeInTheDocument()
    expect(screen.getByText(/\(partial\)/i)).toBeInTheDocument()
  })
})
