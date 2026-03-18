import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimeOffCard from '../TimeOffCard'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/components/ui/staff-link', () => ({
  default: ({ name }: { name: string }) => <span data-testid="staff-link">{name}</span>,
}))
jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: any }) => <>{children}</>,
  Tooltip: ({ children }: { children: any }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: any }) => <>{children}</>,
  TooltipContent: ({ children }: { children: any }) => <>{children}</>,
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

    it('hides coverage badges for drafts even when counts > 0', () => {
      render(
        <TimeOffCard
          {...defaultProps}
          isDraft
          uncovered={1}
          covered={2}
          partial={1}
          totalShifts={4}
        />
      )
      expect(screen.queryByText(/Uncovered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Covered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Partial:/)).not.toBeInTheDocument()
      expect(screen.getByText('Draft')).toBeInTheDocument()
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

    it('sub-finder variant hides coverage badges when isDraft', () => {
      render(
        <TimeOffCard
          {...defaultProps}
          variant="sub-finder"
          isDraft
          uncovered={1}
          covered={0}
          partial={0}
        />
      )
      expect(screen.queryByText(/Uncovered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Covered:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Partial:/)).not.toBeInTheDocument()
    })

    it('dashboard shift details show partial assignment tooltip copy', async () => {
      const user = userEvent.setup()
      render(
        <TimeOffCard
          {...defaultProps}
          variant="dashboard"
          totalShifts={1}
          partial={1}
          covered={0}
          uncovered={0}
          shiftDetails={[
            {
              label: 'Thu AM',
              date: '2026-03-26',
              time_slot_code: 'AM',
              status: 'partial',
              classroom_name: 'Infant Room',
              assigned_sub_name: 'Victoria I.',
            },
          ]}
        />
      )

      await user.click(screen.getByRole('button', { name: /show shift details/i }))
      expect(screen.getByText('Partial shift assigned to Victoria I.')).toBeInTheDocument()
    })

    it('dashboard shift details show multi-partial assignee names in coverage chip and tooltip', async () => {
      const user = userEvent.setup()
      render(
        <TimeOffCard
          {...defaultProps}
          variant="dashboard"
          totalShifts={1}
          partial={1}
          covered={0}
          uncovered={0}
          shiftDetails={[
            {
              label: 'Thu AM',
              date: '2026-03-26',
              time_slot_code: 'AM',
              status: 'partial',
              classroom_name: 'Infant Room',
              assigned_sub_names: ['Bella W.', 'Victoria I.'],
            },
          ]}
        />
      )

      await user.click(screen.getByRole('button', { name: /show shift details/i }))
      expect(screen.getByText('Bella W., Victoria I.')).toBeInTheDocument()
      expect(
        screen.getByText('Partial shift assigned to Bella W., Victoria I.')
      ).toBeInTheDocument()
    })

    it('dashboard shift details respect time_slot_display_order from settings', async () => {
      const user = userEvent.setup()
      render(
        <TimeOffCard
          {...defaultProps}
          variant="dashboard"
          totalShifts={2}
          partial={0}
          covered={1}
          uncovered={1}
          shiftDetails={[
            {
              label: 'Wed AM',
              date: '2026-03-18',
              time_slot_code: 'AM',
              status: 'uncovered',
              classroom_name: 'Infant Room',
              day_display_order: 3,
              time_slot_display_order: 2,
            },
            {
              label: 'Wed EM',
              date: '2026-03-18',
              time_slot_code: 'EM',
              status: 'covered',
              classroom_name: 'Infant Room',
              assigned_sub_name: 'Bella W.',
              day_display_order: 3,
              time_slot_display_order: 1,
            },
          ]}
        />
      )

      await user.click(screen.getByRole('button', { name: /show shift details/i }))
      const shiftButtons = screen.getAllByRole('button', {
        name: /Wed (AM|EM) • Mar 18\./,
      })
      expect(shiftButtons[0]).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Wed EM • Mar 18')
      )
      expect(shiftButtons[1]).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Wed AM • Mar 18')
      )
    })
  })
})
