import { getStaffDisplayName, getStaffNameParts } from '@/lib/api/weekly-schedule'

describe('weekly schedule helpers', () => {
  it('returns Unknown when staff is missing', () => {
    expect(getStaffDisplayName(null, 'first_last_initial')).toBe('Unknown')
  })

  it('formats display names for object and array staff inputs', () => {
    const staff = {
      id: 'staff-1',
      first_name: 'Bella',
      last_name: 'Wilbanks',
      display_name: null,
    }
    expect(getStaffDisplayName(staff, 'first_last_initial')).toBe('Bella W.')
    expect(getStaffDisplayName([staff], 'first_name')).toBe('Bella')
  })

  it('returns normalized name parts for missing and present staff', () => {
    expect(getStaffNameParts(undefined, 'first_last_initial')).toEqual({
      first_name: null,
      last_name: null,
      display_name: null,
    })

    expect(
      getStaffNameParts(
        {
          id: 'staff-2',
          first_name: 'Amy',
          last_name: 'Parks',
          display_name: null,
        },
        'first_last_initial'
      )
    ).toEqual({
      first_name: 'Amy',
      last_name: 'Parks',
      display_name: 'Amy P.',
    })
  })
})
