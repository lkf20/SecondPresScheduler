import { fireEvent, render, screen } from '@testing-library/react'
import ShiftStatusCard from '@/components/sub-finder/ShiftStatusCard'
import { buildSubFinderShift } from '@/tests/factories/entities'
import { coverageColorValues } from '@/lib/utils/colors'

describe('ShiftStatusCard', () => {
  it('renders uncovered status details and absence teacher', () => {
    const shift = buildSubFinderShift({
      status: 'uncovered',
      day_name: 'Monday',
      time_slot_code: 'EM',
      date: '2026-02-09',
    })

    render(<ShiftStatusCard shift={shift} teacherName="Amy P." />)

    expect(screen.getByText(/monday feb 9/i)).toBeInTheDocument()
    expect(screen.getByText(/absence: amy p\./i)).toBeInTheDocument()
    expect(screen.getByText(/uncovered/i)).toBeInTheDocument()
    expect(screen.getByText(/no subs contacted/i)).toBeInTheDocument()
  })

  it('renders confirmed sub label when fully covered with sub name', () => {
    const shift = buildSubFinderShift({
      status: 'fully_covered',
      sub_name: 'Bella W.',
    })

    render(<ShiftStatusCard shift={shift} teacherName="Amy P." />)

    expect(screen.getByText(/covered/i)).toBeInTheDocument()
    expect(screen.getByText(/bella w\./i)).toBeInTheDocument()
  })

  it('shows contacted counts and Find Sub button for uncovered shift', () => {
    const shift = buildSubFinderShift({
      status: 'uncovered',
      day_name: 'Wednesday',
      date: '2026-03-18',
      time_slot_code: 'AM',
    })
    const onSelectShift = jest.fn()

    render(
      <ShiftStatusCard
        shift={shift}
        teacherName="Anne M."
        contactedSubsForShift={[
          { id: 'sub-1', name: 'Sally A.', status: 'pending' },
          { id: 'sub-2', name: 'Bella W.', status: 'confirmed' },
          { id: 'sub-3', name: 'Test S.', status: 'declined' },
        ]}
        onSelectShift={onSelectShift}
      />
    )

    expect(screen.getByText(/uncovered/i)).toBeInTheDocument()
    expect(screen.getByText(/3 contacted/i)).toBeInTheDocument()
    expect(screen.getByText(/1 pending/i)).toBeInTheDocument()
    expect(screen.getByText(/1 declined/i)).toBeInTheDocument()
    const findSubButton = screen.getByRole('button', { name: /find sub for this shift/i })
    expect(findSubButton).toBeInTheDocument()
    findSubButton.click()
    expect(onSelectShift).toHaveBeenCalledWith(shift)
  })

  it('shows per-sub partial rows with time windows for partially covered shift', () => {
    const shift = buildSubFinderShift({
      status: 'partially_covered',
      date: '2026-02-09',
      day_name: 'Monday',
      time_slot_code: 'EM',
      assigned_subs: [
        {
          assignment_id: 'assign-1',
          sub_id: 'sub-1',
          sub_name: 'Victoria I.',
          is_partial: true,
          partial_start_time: '08:00',
          partial_end_time: '10:30',
        },
      ],
    })

    render(<ShiftStatusCard shift={shift} teacherName="Amy P." />)

    expect(screen.getByText(/Victoria I\. \(8 am to 10:30 am\)/i)).toBeInTheDocument()
  })

  it('renders one row per assignment and keeps Add Sub visible for multi-assignment shifts', () => {
    const shift = buildSubFinderShift({
      status: 'partially_covered',
      assigned_subs: [
        {
          assignment_id: 'assign-1',
          sub_id: 'sub-1',
          sub_name: 'Victoria I.',
          is_partial: true,
          partial_start_time: '09:00',
          partial_end_time: '10:30',
        },
        {
          assignment_id: 'assign-2',
          sub_id: 'sub-2',
          sub_name: 'Laura O.',
          is_partial: true,
          partial_start_time: '10:30',
          partial_end_time: '12:00',
        },
      ],
    })

    render(<ShiftStatusCard shift={shift} teacherName="Amy P." onSelectShift={jest.fn()} />)

    expect(screen.getByText(/Victoria I\./i)).toBeInTheDocument()
    expect(screen.getByText(/Laura O\./i)).toBeInTheDocument()
    const firstPartialBadge = screen.getByText(/Victoria I\./i).closest('p')
    expect(firstPartialBadge).toHaveStyle({
      backgroundColor: coverageColorValues.partialAssignedPill.bg,
    })
    const addSubButton = screen.getByRole('button', { name: /add another sub to this shift/i })
    expect(addSubButton).toBeInTheDocument()
    expect(addSubButton.className).toContain('self-end')
  })

  it('shows (partial) fallback when partial times are missing', () => {
    const shift = buildSubFinderShift({
      status: 'partially_covered',
      assigned_subs: [
        {
          assignment_id: 'assign-1',
          sub_id: 'sub-1',
          sub_name: 'Victoria I.',
          is_partial: true,
          partial_start_time: null,
          partial_end_time: null,
        },
      ],
    })

    render(<ShiftStatusCard shift={shift} teacherName="Amy P." />)

    expect(screen.getByText(/Victoria I\. \(partial\)/i)).toBeInTheDocument()
  })

  it('uses row assignment_id for remove actions', () => {
    const onRemoveSubByAssignmentId = jest.fn()
    const shift = buildSubFinderShift({
      status: 'partially_covered',
      assigned_subs: [
        {
          assignment_id: 'assign-1',
          sub_id: 'sub-1',
          sub_name: 'Victoria I.',
          is_partial: true,
        },
        {
          assignment_id: 'assign-2',
          sub_id: 'sub-2',
          sub_name: 'Laura O.',
          is_partial: true,
        },
      ],
    })

    render(
      <ShiftStatusCard
        shift={shift}
        teacherName="Amy P."
        onRemoveSubByAssignmentId={onRemoveSubByAssignmentId}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /remove Laura O\./i }))
    expect(onRemoveSubByAssignmentId).toHaveBeenCalledWith(shift, 'assign-2')
  })

  it('uses row assignment_id for change actions', () => {
    const onChangeSubByAssignmentId = jest.fn()
    const shift = buildSubFinderShift({
      status: 'partially_covered',
      assigned_subs: [
        {
          assignment_id: 'assign-1',
          sub_id: 'sub-1',
          sub_name: 'Victoria I.',
          is_partial: true,
        },
        {
          assignment_id: 'assign-2',
          sub_id: 'sub-2',
          sub_name: 'Laura O.',
          is_partial: true,
        },
      ],
    })

    render(
      <ShiftStatusCard
        shift={shift}
        teacherName="Amy P."
        onChangeSubByAssignmentId={onChangeSubByAssignmentId}
      />
    )

    expect(screen.queryByText(/^Change$/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /change laura o\./i }))
    expect(onChangeSubByAssignmentId).toHaveBeenCalledWith(shift, 'assign-2')
  })
})
