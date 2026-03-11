import {
  getEffectiveClassroomIds,
  getEffectiveTimeSlotIds,
  isStaffingNarrowing,
  type ScheduleFilterInput,
  type ItemWithActive,
} from '../schedule-filter-helpers'

describe('schedule-filter-helpers', () => {
  describe('getEffectiveClassroomIds', () => {
    const availableClassrooms: ItemWithActive[] = [
      { id: 'c1', is_active: true },
      { id: 'c2', is_active: false },
      { id: 'c3', is_active: true },
    ]

    it('returns all selected classroom ids when showInactiveClassrooms is true', () => {
      const filters: ScheduleFilterInput = {
        selectedClassroomIds: ['c1', 'c2', 'c3'],
        selectedTimeSlotIds: [],
        showInactiveClassrooms: true,
      }
      expect(getEffectiveClassroomIds(filters, availableClassrooms)).toEqual(['c1', 'c2', 'c3'])
    })

    it('returns only active classroom ids when showInactiveClassrooms is false', () => {
      const filters: ScheduleFilterInput = {
        selectedClassroomIds: ['c1', 'c2', 'c3'],
        selectedTimeSlotIds: [],
        showInactiveClassrooms: false,
      }
      expect(getEffectiveClassroomIds(filters, availableClassrooms)).toEqual(['c1', 'c3'])
    })

    it('defaults showInactiveClassrooms to false when undefined', () => {
      const filters: ScheduleFilterInput = {
        selectedClassroomIds: ['c1', 'c2'],
        selectedTimeSlotIds: [],
      }
      // c2 is inactive, so with default false we only get active c1
      expect(getEffectiveClassroomIds(filters, availableClassrooms)).toEqual(['c1'])
    })

    it('omits selected ids that are not in available list when showing only active', () => {
      const filters: ScheduleFilterInput = {
        selectedClassroomIds: ['c1', 'c99'],
        selectedTimeSlotIds: [],
        showInactiveClassrooms: false,
      }
      expect(getEffectiveClassroomIds(filters, availableClassrooms)).toEqual(['c1'])
    })

    it('treats items with is_active undefined as active', () => {
      const withUndefined: ItemWithActive[] = [{ id: 'c1' }, { id: 'c2', is_active: false }]
      const filters: ScheduleFilterInput = {
        selectedClassroomIds: ['c1', 'c2'],
        selectedTimeSlotIds: [],
        showInactiveClassrooms: false,
      }
      expect(getEffectiveClassroomIds(filters, withUndefined)).toEqual(['c1'])
    })
  })

  describe('getEffectiveTimeSlotIds', () => {
    const availableTimeSlots: ItemWithActive[] = [
      { id: 'ts1', is_active: true },
      { id: 'ts2', is_active: false },
      { id: 'ts3', is_active: true },
    ]

    it('returns all selected time slot ids when showInactiveTimeSlots is true', () => {
      const filters: ScheduleFilterInput = {
        selectedClassroomIds: [],
        selectedTimeSlotIds: ['ts1', 'ts2', 'ts3'],
        showInactiveTimeSlots: true,
      }
      expect(getEffectiveTimeSlotIds(filters, availableTimeSlots)).toEqual(['ts1', 'ts2', 'ts3'])
    })

    it('returns only active time slot ids when showInactiveTimeSlots is false', () => {
      const filters: ScheduleFilterInput = {
        selectedClassroomIds: [],
        selectedTimeSlotIds: ['ts1', 'ts2', 'ts3'],
        showInactiveTimeSlots: false,
      }
      expect(getEffectiveTimeSlotIds(filters, availableTimeSlots)).toEqual(['ts1', 'ts3'])
    })

    it('defaults showInactiveTimeSlots to false when undefined', () => {
      const filters: ScheduleFilterInput = {
        selectedClassroomIds: [],
        selectedTimeSlotIds: ['ts1', 'ts2'],
      }
      // ts2 is inactive, so with default false we only get active ts1
      expect(getEffectiveTimeSlotIds(filters, availableTimeSlots)).toEqual(['ts1'])
    })
  })

  describe('isStaffingNarrowing', () => {
    it('returns false when slotFilterMode is "all"', () => {
      expect(
        isStaffingNarrowing({
          selectedClassroomIds: [],
          selectedTimeSlotIds: [],
          slotFilterMode: 'all',
          displayFilters: {
            belowRequired: false,
            belowPreferred: false,
            fullyStaffed: false,
            inactive: false,
          },
        })
      ).toBe(false)
    })

    it('returns false when slotFilterMode is "select" but all staffing checkboxes are true', () => {
      expect(
        isStaffingNarrowing({
          selectedClassroomIds: [],
          selectedTimeSlotIds: [],
          slotFilterMode: 'select',
          displayFilters: {
            belowRequired: true,
            belowPreferred: true,
            fullyStaffed: true,
            inactive: true,
          },
        })
      ).toBe(false)
    })

    it('returns true when slotFilterMode is "select" and at least one checkbox is false', () => {
      expect(
        isStaffingNarrowing({
          selectedClassroomIds: [],
          selectedTimeSlotIds: [],
          slotFilterMode: 'select',
          displayFilters: {
            belowRequired: true,
            belowPreferred: true,
            fullyStaffed: false,
            inactive: true,
          },
        })
      ).toBe(true)
    })

    it('defaults slotFilterMode to "all" when undefined', () => {
      expect(
        isStaffingNarrowing({
          selectedClassroomIds: [],
          selectedTimeSlotIds: [],
          displayFilters: {
            belowRequired: false,
            belowPreferred: false,
            fullyStaffed: false,
            inactive: false,
          },
        })
      ).toBe(false)
    })

    it('returns false when displayFilters is undefined (no collapse)', () => {
      expect(
        isStaffingNarrowing({
          selectedClassroomIds: [],
          selectedTimeSlotIds: [],
          slotFilterMode: 'select',
        })
      ).toBe(false)
    })
  })
})
