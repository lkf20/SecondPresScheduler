import { renderHook } from '@testing-library/react'
import { useSubFinderShifts } from '@/components/sub-finder/hooks/useSubFinderShifts'
import type { Absence } from '@/components/sub-finder/hooks/useSubFinderData'

describe('useSubFinderShifts', () => {
  it('preserves assigned_subs rows for partially covered shifts', () => {
    const absence: Absence = {
      id: 'absence-1',
      teacher_id: 'teacher-1',
      teacher_name: 'Anne M.',
      start_date: '2099-03-26',
      end_date: '2099-03-26',
      reason: 'Vacation',
      shifts: {
        total: 1,
        uncovered: 0,
        partially_covered: 1,
        fully_covered: 0,
        shift_details: [
          {
            id: 'shift-1',
            date: '2099-03-26',
            day_name: 'Thu',
            time_slot_code: 'AM',
            class_name: 'Infant',
            classroom_name: 'Infant Room',
            classroom_color: '#dbeafe',
            status: 'partially_covered',
            assigned_sub_names: ['Victoria I.', 'Laura O.'],
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
          },
        ],
      },
    }

    const { result } = renderHook(() => useSubFinderShifts(absence, true))

    expect(result.current.shiftDetails).toHaveLength(1)
    expect(result.current.shiftDetails[0].assigned_subs).toEqual([
      expect.objectContaining({ assignment_id: 'assign-1', sub_name: 'Victoria I.' }),
      expect.objectContaining({ assignment_id: 'assign-2', sub_name: 'Laura O.' }),
    ])
  })
})
