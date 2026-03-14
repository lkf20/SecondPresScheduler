import { render, screen } from '@testing-library/react'
import TimeOffCard from '../TimeOffCard'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/components/ui/staff-link', () => ({
  default: ({ name }: { name: string }) => <span data-testid="staff-link">{name}</span>,
}))

const defaultProps = {
  id: 'req-1',
  teacherName: 'Jane Doe',
  startDate: '2026-02-10',
  endDate: '2026-02-10',
  reason: null as string | null,
  classrooms: [],
  variant: 'time-off' as const,
}

describe('TimeOffCard', () => {
  describe('coverage badges', () => {
    it('shows Uncovered badge only when uncovered > 0', () => {
      render(<TimeOffCard {...defaultProps} uncovered={2} covered={0} partial={0} />)
      expect(screen.getByText(/Uncovered: 2/)).toBeInTheDocument()
      expect(screen.queryByText(/Covered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Partial:/)).not.toBeInTheDocument()
    })

    it('shows Covered badge only when covered > 0', () => {
      render(<TimeOffCard {...defaultProps} covered={3} uncovered={0} partial={0} />)
      expect(screen.getByText(/Covered: 3/)).toBeInTheDocument()
      expect(screen.queryByText(/Uncovered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Partial:/)).not.toBeInTheDocument()
    })

    it('shows Partial badge only when partial > 0', () => {
      render(<TimeOffCard {...defaultProps} partial={1} covered={0} uncovered={0} />)
      expect(screen.getByText(/Partial: 1/)).toBeInTheDocument()
      expect(screen.queryByText(/Uncovered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Covered:/)).not.toBeInTheDocument()
    })

    it('shows all three badges when all counts > 0', () => {
      render(
        <TimeOffCard {...defaultProps} uncovered={1} covered={2} partial={1} totalShifts={4} />
      )
      expect(screen.getByText(/Uncovered: 1/)).toBeInTheDocument()
      expect(screen.getByText(/Covered: 2/)).toBeInTheDocument()
      expect(screen.getByText(/Partial: 1/)).toBeInTheDocument()
    })

    it('shows no coverage badges when all counts are 0', () => {
      render(<TimeOffCard {...defaultProps} covered={0} uncovered={0} partial={0} />)
      expect(screen.queryByText(/Uncovered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Covered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Partial:/)).not.toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('renders sub-finder variant with badges and Find Subs button', () => {
      render(
        <TimeOffCard {...defaultProps} variant="sub-finder" uncovered={1} covered={0} partial={0} />
      )
      expect(screen.getByText(/Uncovered: 1/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Find Subs/ })).toBeInTheDocument()
    })

    it('renders time-off variant with teacher name and date', () => {
      render(
        <TimeOffCard
          {...defaultProps}
          variant="time-off"
          teacherName="Amy P."
          startDate="2026-03-16"
        />
      )
      expect(screen.getByText('Amy P.')).toBeInTheDocument()
    })

    it('renders draft stamp when isDraft', () => {
      render(<TimeOffCard {...defaultProps} isDraft />)
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })
  })
})
