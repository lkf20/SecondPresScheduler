import {
  generateClassroomsXDaysGridTemplate,
  generateDaysXClassroomsGridTemplate,
  hexToRgba,
} from '@/components/schedules/WeeklyScheduleGridNew'

describe('WeeklyScheduleGridNew helpers', () => {
  it('converts hex colors to rgba values', () => {
    expect(hexToRgba('#4A90E2', 0.5)).toBe('rgba(74, 144, 226, 0.5)')
    expect(hexToRgba('112233')).toBe('rgba(17, 34, 51, 0.08)')
  })

  it('builds grid template for days x classrooms layout', () => {
    const result = generateDaysXClassroomsGridTemplate(
      2,
      [
        { id: 'day-1', name: 'Monday', number: 1 },
        { id: 'day-2', name: 'Tuesday', number: 2 },
      ],
      [
        { id: 'slot-1', code: 'AM' },
        { id: 'slot-2', code: 'MID' },
      ]
    )

    expect(result.columns).toBe('120px repeat(2, minmax(230px, 1fr))')
    expect(result.rows).toBe(
      'auto 36px minmax(120px, auto) minmax(120px, auto) 16px 36px minmax(120px, auto) minmax(120px, auto)'
    )
  })

  it('builds grid template for classrooms x days layout', () => {
    const result = generateClassroomsXDaysGridTemplate(3, 2)

    expect(result.columns).toBe(
      '110px repeat(2, minmax(230px, 1fr)) repeat(2, minmax(230px, 1fr)) repeat(2, minmax(230px, 1fr))'
    )
    expect(result.rows).toBe('auto auto repeat(auto, minmax(120px, auto))')
  })

  it('uses zero-row template when there are no selected days', () => {
    const result = generateClassroomsXDaysGridTemplate(0, 2)

    expect(result.columns).toBe('110px ')
    expect(result.rows).toBe('auto auto repeat(0, minmax(120px, auto))')
  })
})
