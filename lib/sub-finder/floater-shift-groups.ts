import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'
import { getShiftKey } from '@/lib/sub-finder/shift-helpers'
import { parseLocalDate } from '@/lib/utils/date'
import { DAY_NAMES, MONTH_NAMES } from '@/lib/utils/date-format'

/** Shown next to “X of Y shifts need coverage” summaries (Sub Finder, coverage cards). */
export const SHIFT_COUNT_SEMANTICS_TOOLTIP =
  'Counts each classroom separately when a teacher floats two rooms at the same time.'

/** Weekly schedule floater badge: keep in sync with `WeeklyScheduleGridNew` legend chip. */
export const FLOATER_SHIFT_GROUP_CONTAINER_CLASS =
  'rounded-lg border border-dashed border-purple-300 bg-purple-100 p-3'

export const FLOATER_SHIFT_GROUP_HEADER_CLASS = 'text-xs font-semibold text-purple-800 mb-2'

export type FloaterGroupableShift = {
  date: string
  time_slot_code: string
  classroom_id?: string | null
  classroom_name?: string | null
  day_display_order?: number | null
  time_slot_display_order?: number | null
}

/** Stable per-row key: same as Sub Finder `getShiftKey` (room-level shifts are distinct). */
export function shiftChipRowKey(shift: FloaterGroupableShift): string {
  return getShiftKey({
    date: shift.date,
    time_slot_code: shift.time_slot_code,
    classroom_id: shift.classroom_id ?? null,
    classroom_name: shift.classroom_name ?? null,
  })
}

/** `date|time_slot_code` only — used to detect same calendar slot across rooms. */
export function slotOnlyKey(shift: Pick<FloaterGroupableShift, 'date' | 'time_slot_code'>): string {
  return `${shift.date}|${shift.time_slot_code}`
}

export type FloaterUiGroup<T extends FloaterGroupableShift> =
  | { kind: 'floater'; slotKey: string; shifts: T[] }
  | { kind: 'single'; shift: T }

/**
 * After sorting, group consecutive logical slots: when 2+ rows share the same date+time_slot
 * (floater / multi-room), wrap them as one floater group for purple UI. Single-room rows stay alone.
 */
export function groupShiftsForFloaterUi<T extends FloaterGroupableShift>(
  shifts: T[]
): FloaterUiGroup<T>[] {
  if (shifts.length === 0) return []
  const sorted = sortShiftDetailsByDisplayOrder([...shifts]) as T[]
  /** Same logical row must not appear twice (e.g. duplicate CRS rows); keep first in sort order. */
  const seenRowKeys = new Set<string>()
  const uniqueSorted: T[] = []
  sorted.forEach(s => {
    const rk = shiftChipRowKey(s)
    if (seenRowKeys.has(rk)) return
    seenRowKeys.add(rk)
    uniqueSorted.push(s)
  })
  const bySlot = new Map<string, T[]>()
  uniqueSorted.forEach(s => {
    const k = slotOnlyKey(s)
    const list = bySlot.get(k) || []
    list.push(s)
    bySlot.set(k, list)
  })

  const seenRow = new Set<string>()
  const out: FloaterUiGroup<T>[] = []

  for (const s of uniqueSorted) {
    const rowK = shiftChipRowKey(s)
    if (seenRow.has(rowK)) continue
    const slotK = slotOnlyKey(s)
    const bucket = bySlot.get(slotK) || []
    if (bucket.length >= 2) {
      bucket.forEach(b => seenRow.add(shiftChipRowKey(b)))
      out.push({ kind: 'floater', slotKey: slotK, shifts: bucket })
    } else {
      seenRow.add(rowK)
      out.push({ kind: 'single', shift: s })
    }
  }

  return out
}

export function floaterGroupHeaderLabel(shifts: FloaterGroupableShift[]): string {
  if (shifts.length === 0) return 'Floater'
  const first = shifts[0]
  const date = parseLocalDate(first.date)
  const dayName = DAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return `${dayName} ${first.time_slot_code} · ${month} ${day} · Floater · ${shifts.length} rooms`
}
