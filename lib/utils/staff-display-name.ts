import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']

export type DisplayNameFormat =
  | 'first_last_initial'
  | 'first_initial_last'
  | 'first_last'
  | 'first_name'

const safeTrim = (value?: string | null) => value?.trim() || ''

export function formatStaffDisplayName(
  staff: Pick<Staff, 'first_name' | 'last_name' | 'display_name'>,
  format: DisplayNameFormat
): string {
  const firstName = safeTrim(staff.first_name)
  const lastName = safeTrim(staff.last_name)

  const firstInitial = firstName ? firstName[0] : ''
  const lastInitial = lastName ? lastName[0] : ''
  const initialWithPeriod = (value: string) => (value ? `${value}.` : '')
  const firstInitialWithPeriod = initialWithPeriod(firstInitial)
  const lastInitialWithPeriod = initialWithPeriod(lastInitial)

  const combine = (...parts: string[]) => parts.filter(Boolean).join(' ').trim()

  switch (format) {
    case 'first_last_initial':
      return combine(firstName, lastInitialWithPeriod)
    case 'first_initial_last':
      return combine(firstInitialWithPeriod, lastName)
    case 'first_last':
      return combine(firstName, lastName)
    case 'first_name':
      return firstName
    default:
      return staff.display_name || combine(firstName, lastName)
  }
}

export function computeDisplayName(
  staff: Pick<Staff, 'first_name' | 'last_name' | 'display_name'>,
  format: DisplayNameFormat
): { name: string; isCustom: boolean } {
  const formatted = formatStaffDisplayName(staff, format)
  const customValue = staff.display_name?.trim() || ''
  const knownFormats: DisplayNameFormat[] = [
    'first_last_initial',
    'first_initial_last',
    'first_last',
    'first_name',
  ]
  const matchesKnownFormat =
    customValue.length > 0 &&
    knownFormats.some(candidate => formatStaffDisplayName(staff, candidate) === customValue)
  const hasCustom = customValue.length > 0 && !matchesKnownFormat

  if (hasCustom) {
    return { name: customValue, isCustom: true }
  }

  return { name: formatted, isCustom: false }
}

export function getStaffDisplayName(
  staff: Pick<Staff, 'first_name' | 'last_name' | 'display_name'>,
  format?: DisplayNameFormat
) {
  const effectiveFormat = format || 'first_last_initial'
  return computeDisplayName(staff, effectiveFormat).name
}

export function buildDuplicateDisplayNameMap(
  staffList: Array<Pick<Staff, 'id' | 'first_name' | 'last_name' | 'display_name'>>,
  format: DisplayNameFormat
) {
  const counts = new Map<string, number>()

  staffList.forEach(staff => {
    const { name } = computeDisplayName(staff, format)
    const key = name.trim().toLocaleLowerCase()
    if (!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return counts
}
