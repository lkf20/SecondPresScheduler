import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShiftChips, { formatShiftLabel } from '@/components/sub-finder/ShiftChips'
import { coverageColorValues } from '@/lib/utils/colors'

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: any }) => <>{children}</>,
  Tooltip: ({ children }: { children: any }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: any }) => <>{children}</>,
  TooltipContent: ({ children }: { children: any }) => <>{children}</>,
}))

describe('ShiftChips', () => {
  it('formats shift labels with day, slot code, and date', () => {
    expect(formatShiftLabel('2026-02-09', 'EM')).toBe('Mon EM • Feb 9')
  })

  it('renders nothing when there are no shifts', () => {
    const { container } = render(
      <ShiftChips mode="availability" canCover={[]} cannotCover={[]} assigned={[]} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('prioritizes assigned shifts when the same shift exists in multiple arrays', () => {
    render(
      <ShiftChips
        mode="availability"
        assigned={[{ date: '2026-02-09', time_slot_code: 'EM', classroom_name: 'Infant Room' }]}
        canCover={[{ date: '2026-02-09', time_slot_code: 'EM' }]}
        cannotCover={[{ date: '2026-02-09', time_slot_code: 'EM', reason: 'Unavailable' }]}
      />
    )

    // Room-level keys: assigned row and generic slot row are distinct; floater group shows both.
    expect(screen.getByRole('group', { name: /Floater · 2 rooms/i })).toBeInTheDocument()
    expect(screen.getAllByText('Mon EM')).toHaveLength(2)
    expect(screen.getAllByText('Feb 9')).toHaveLength(2)
    expect(screen.getAllByText('Infant Room').length).toBeGreaterThanOrEqual(1)
  })

  it('shows legend when enabled', () => {
    render(
      <ShiftChips
        mode="availability"
        assigned={[{ date: '2026-02-09', time_slot_code: 'EM' }]}
        canCover={[]}
        cannotCover={[]}
        showLegend
      />
    )

    expect(screen.getByText('Assigned Sub')).toBeInTheDocument()
    expect(screen.getByText('Can cover')).toBeInTheDocument()
    expect(screen.getByText('Cannot cover')).toBeInTheDocument()
  })

  it('uses partial coverage icon + tooltip copy for partial assignment chips', () => {
    const { container } = render(
      <ShiftChips
        mode="coverage"
        shifts={[
          {
            date: '2026-03-26',
            time_slot_code: 'AM',
            status: 'partial',
            classroom_name: 'Infant Room',
            assigned_sub_name: 'Victoria I.',
          },
        ]}
      />
    )

    expect(screen.getByText('Victoria I.')).toBeInTheDocument()
    expect(screen.getByText('Partial shift assigned to Victoria I.')).toBeInTheDocument()
    expect(container.querySelector('.lucide-clock-3')).toBeTruthy()
    const partialPill = screen.getByText('Victoria I.').parentElement as HTMLElement
    expect(partialPill).toHaveStyle({
      backgroundColor: coverageColorValues.partialAssignedPill.bg,
      borderColor: coverageColorValues.partialAssignedPill.border,
      color: coverageColorValues.partialAssignedPill.text,
    })
  })

  it('uses original assigned-sub pill style for covered shifts with assignee name', () => {
    render(
      <ShiftChips
        mode="coverage"
        shifts={[
          {
            date: '2026-03-26',
            time_slot_code: 'EM',
            status: 'covered',
            classroom_name: 'Infant Room',
            assigned_sub_name: 'Bella W.',
          },
        ]}
      />
    )

    const coveredPill = screen.getByText('Bella W.').parentElement as HTMLElement
    expect(coveredPill).toHaveStyle({
      backgroundColor: 'rgb(204, 251, 241)',
      borderColor: 'rgb(153, 246, 228)',
      color: 'rgb(15, 118, 110)',
    })
  })

  it('sorts shifts by date and time_slot_display_order when shifts prop is provided', () => {
    render(
      <ShiftChips
        mode="availability"
        shifts={[
          {
            date: '2026-03-27',
            time_slot_code: 'EM',
            status: 'uncovered',
            day_display_order: 5,
            time_slot_display_order: 2,
          },
          {
            date: '2026-03-26',
            time_slot_code: 'AM',
            status: 'uncovered',
            day_display_order: 4,
            time_slot_display_order: 2,
          },
          {
            date: '2026-03-26',
            time_slot_code: 'EM',
            status: 'uncovered',
            day_display_order: 4,
            time_slot_display_order: 1,
          },
        ]}
      />
    )

    const labels = screen
      .getAllByText(/^(Thu|Fri) (AM|EM)$/)
      .map(node => node.textContent)
      .filter(Boolean)
    expect(labels).toEqual(['Thu EM', 'Thu AM', 'Fri EM'])
  })

  it('uses keyboard-focusable tooltip trigger buttons', async () => {
    const user = userEvent.setup()
    render(
      <ShiftChips
        mode="coverage"
        shifts={[
          {
            date: '2026-03-26',
            time_slot_code: 'AM',
            status: 'partial',
            classroom_name: 'Infant Room',
            assigned_sub_name: 'Victoria I.',
          },
        ]}
      />
    )

    await user.tab()
    const trigger = screen.getByRole('button', {
      name: /Thu AM • Mar 26\. Infant Room\. Partial shift assigned to Victoria I\./i,
    })
    expect(trigger).toHaveFocus()
  })

  it('shows soft green available background and recommended amber corner dot in availability mode', () => {
    const { container } = render(
      <ShiftChips
        mode="availability"
        canCover={[{ date: '2026-03-26', time_slot_code: 'AM', classroom_name: 'Infant Room' }]}
        cannotCover={[]}
        recommendedShifts={[{ date: '2026-03-26', time_slot_code: 'AM' }]}
      />
    )

    const trigger = screen.getByRole('button', {
      name: /Thu AM • Mar 26\. Infant Room\. This sub can cover this shift/i,
    })
    const badge = trigger.querySelector('.box-border') as HTMLElement
    expect(badge).toBeTruthy()
    expect(badge).toHaveStyle({
      backgroundColor: 'rgb(246, 253, 251)',
      borderColor: 'rgb(196, 234, 226)',
    })

    const recommendedDot = container.querySelector(
      'div[style*="background-color: rgb(253, 230, 138)"]'
    )
    expect(recommendedDot).toBeTruthy()
  })
})
