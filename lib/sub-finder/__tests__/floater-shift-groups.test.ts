import {
  floaterGroupHeaderLabel,
  groupShiftsForFloaterUi,
  shiftChipRowKey,
} from '@/lib/sub-finder/floater-shift-groups'

describe('floater-shift-groups', () => {
  it('shiftChipRowKey distinguishes classrooms at the same date and slot', () => {
    const a = {
      date: '2026-02-09',
      time_slot_code: 'EM',
      classroom_id: 'c1',
      classroom_name: 'Infant',
      day_display_order: 2,
      time_slot_display_order: 1,
    }
    const b = { ...a, classroom_id: 'c2', classroom_name: 'Toddler' }
    expect(shiftChipRowKey(a)).not.toEqual(shiftChipRowKey(b))
  })

  it('groups two room-level rows for the same slot into one floater UI group', () => {
    const s1 = {
      id: '1',
      date: '2026-02-09',
      time_slot_code: 'EM',
      classroom_id: 'c1',
      classroom_name: 'Infant',
      day_display_order: 2,
      time_slot_display_order: 1,
    }
    const s2 = { ...s1, id: '2', classroom_id: 'c2', classroom_name: 'Toddler' }
    const groups = groupShiftsForFloaterUi([s1, s2])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.kind).toBe('floater')
    if (groups[0]?.kind === 'floater') {
      expect(groups[0].shifts).toHaveLength(2)
      expect(floaterGroupHeaderLabel(groups[0].shifts)).toMatch(/Floater · 2 rooms/)
    }
  })

  it('leaves a single room row ungrouped', () => {
    const s1 = {
      id: '1',
      date: '2026-02-09',
      time_slot_code: 'EM',
      classroom_id: 'c1',
      classroom_name: 'Infant',
      day_display_order: 2,
      time_slot_display_order: 1,
    }
    const groups = groupShiftsForFloaterUi([s1])
    expect(groups).toEqual([{ kind: 'single', shift: s1 }])
  })

  it('dedupes identical shift rows before grouping (duplicate CRS rows)', () => {
    const s1 = {
      id: '1',
      date: '2026-02-09',
      time_slot_code: 'EM',
      classroom_id: 'c1',
      classroom_name: 'Infant',
      day_display_order: 2,
      time_slot_display_order: 1,
    }
    const dup = { ...s1, id: '2' }
    const groups = groupShiftsForFloaterUi([s1, dup])
    expect(groups).toEqual([{ kind: 'single', shift: s1 }])
  })
})
