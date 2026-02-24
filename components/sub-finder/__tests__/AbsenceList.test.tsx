import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbsenceList from '@/components/sub-finder/AbsenceList'

jest.mock('@/components/shared/TimeOffCard', () => {
  const MockTimeOffCard = ({
    id,
    teacherName,
    classrooms,
    onSelect,
    onFindSubs,
  }: {
    id: string
    teacherName: string
    classrooms?: Array<{ name: string }>
    onSelect?: () => void
    onFindSubs?: () => void
  }) => (
    <div>
      <button type="button" onClick={onSelect}>
        {teacherName}
      </button>
      <span>{(classrooms || []).map(classroom => classroom.name).join(', ')}</span>
      <button type="button" onClick={onFindSubs}>
        Find subs for {id}
      </button>
    </div>
  )
  MockTimeOffCard.displayName = 'MockTimeOffCard'
  return MockTimeOffCard
})

describe('AbsenceList', () => {
  it('renders empty state when there are no absences', () => {
    render(
      <AbsenceList
        absences={[]}
        selectedAbsence={null}
        onSelectAbsence={jest.fn()}
        onFindSubs={jest.fn()}
        loading={false}
      />
    )

    expect(screen.getByText(/no absences found/i)).toBeInTheDocument()
  })

  it('renders absences and triggers selection + find subs actions', async () => {
    const user = userEvent.setup()
    const onSelectAbsence = jest.fn()
    const onFindSubs = jest.fn()
    const absence = {
      id: 'absence-1',
      teacher_id: 'teacher-1',
      teacher_name: 'Amy P.',
      start_date: '2026-02-10',
      end_date: '2026-02-10',
      reason: 'Sick Day',
      shifts: {
        total: 1,
        uncovered: 1,
        partially_covered: 0,
        fully_covered: 0,
        shift_details: [
          {
            id: 'shift-1',
            date: '2026-02-10',
            day_name: 'Tuesday',
            time_slot_code: 'EM',
            class_name: 'Toddler A',
            classroom_name: 'Toddler A Room',
            status: 'uncovered' as const,
          },
        ],
      },
    }

    render(
      <AbsenceList
        absences={[absence]}
        selectedAbsence={null}
        onSelectAbsence={onSelectAbsence}
        onFindSubs={onFindSubs}
        loading={false}
      />
    )

    expect(screen.getByText('Toddler A Room')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Amy P.' }))
    expect(onSelectAbsence).toHaveBeenCalledWith(absence)
    expect(onFindSubs).toHaveBeenCalledWith(absence)

    await user.click(screen.getByRole('button', { name: /find subs for absence-1/i }))
    expect(onFindSubs).toHaveBeenCalledTimes(2)
  })
})
