import {
  buildDuplicateDisplayNameMap,
  computeDisplayName,
  formatStaffDisplayName,
} from '@/lib/utils/staff-display-name'

const staff = (first: string, last: string, displayName?: string) => ({
  id: `${first}-${last}`,
  first_name: first,
  last_name: last,
  display_name: displayName ?? null,
})

describe('formatStaffDisplayName', () => {
  it('formats first + last initial', () => {
    expect(formatStaffDisplayName(staff('Lisa', 'Bohn'), 'first_last_initial')).toBe('Lisa B.')
  })

  it('formats first initial + last', () => {
    expect(formatStaffDisplayName(staff('Lisa', 'Bohn'), 'first_initial_last')).toBe('L. Bohn')
  })

  it('formats first + last', () => {
    expect(formatStaffDisplayName(staff('Lisa', 'Bohn'), 'first_last')).toBe('Lisa Bohn')
  })

  it('formats first name only', () => {
    expect(formatStaffDisplayName(staff('Lisa', 'Bohn'), 'first_name')).toBe('Lisa')
  })

  it('handles missing last name', () => {
    expect(formatStaffDisplayName(staff('Lisa', ''), 'first_last_initial')).toBe('Lisa')
  })
})

describe('computeDisplayName', () => {
  it('uses custom display name when present', () => {
    const result = computeDisplayName(staff('Lisa', 'Bohn', 'Coach Lisa'), 'first_last')
    expect(result).toEqual({ name: 'Coach Lisa', isCustom: true })
  })

  it('uses formatted name when no override', () => {
    const result = computeDisplayName(staff('Lisa', 'Bohn'), 'first_last')
    expect(result).toEqual({ name: 'Lisa Bohn', isCustom: false })
  })
})

describe('buildDuplicateDisplayNameMap', () => {
  it('detects duplicates case-insensitively', () => {
    const duplicates = buildDuplicateDisplayNameMap(
      [staff('Lisa', 'Bohn'), staff('lisa', 'bohn')],
      'first_last'
    )
    expect(duplicates.get('lisa bohn')).toBe(2)
  })

  it('ignores blank names', () => {
    const duplicates = buildDuplicateDisplayNameMap(
      [{ id: '1', first_name: '', last_name: '', display_name: null }],
      'first_last'
    )
    expect(duplicates.size).toBe(0)
  })
})
