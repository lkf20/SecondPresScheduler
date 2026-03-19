import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'

describe('sortShiftDetailsByDisplayOrder', () => {
  it('sorts by date then day_display_order then time_slot_display_order', () => {
    const sorted = sortShiftDetailsByDisplayOrder([
      {
        date: '2026-03-19',
        day_display_order: 4,
        time_slot_display_order: 2,
        time_slot_code: 'AM',
      },
      {
        date: '2026-03-18',
        day_display_order: 3,
        time_slot_display_order: 2,
        time_slot_code: 'AM',
      },
      {
        date: '2026-03-18',
        day_display_order: 3,
        time_slot_display_order: 1,
        time_slot_code: 'EM',
      },
    ])

    expect(sorted.map(s => `${s.date}|${s.time_slot_code}`)).toEqual([
      '2026-03-18|EM',
      '2026-03-18|AM',
      '2026-03-19|AM',
    ])
  })

  it('preserves input order when display-order metadata is missing', () => {
    const sorted = sortShiftDetailsByDisplayOrder([
      {
        date: '2026-03-18',
        day_display_order: null,
        time_slot_display_order: null,
        time_slot_code: 'EM',
      },
      {
        date: '2026-03-18',
        day_display_order: null,
        time_slot_display_order: null,
        time_slot_code: 'AM',
      },
    ])

    expect(sorted.map(s => s.time_slot_code)).toEqual(['EM', 'AM'])
  })
})
