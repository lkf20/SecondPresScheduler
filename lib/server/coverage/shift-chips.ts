import { parseLocalDate } from '@/lib/utils/date'

export type ShiftChipStatus = 'assigned' | 'available' | 'unavailable'

export type ShiftChip = {
  date: string
  time_slot_code: string
  status: ShiftChipStatus
  reason?: string
  classroom_name?: string | null
  class_name?: string | null
}

type ShiftInput = {
  date: string
  time_slot_code: string
  reason?: string
  classroom_name?: string | null
  class_name?: string | null
}

export const buildShiftChips = ({
  assigned = [],
  canCover = [],
  cannotCover = [],
  allowedShiftKeys,
}: {
  assigned?: ShiftInput[]
  canCover?: ShiftInput[]
  cannotCover?: ShiftInput[]
  allowedShiftKeys?: string[]
}): ShiftChip[] => {
  const allowed = allowedShiftKeys ? new Set(allowedShiftKeys) : null
  const allShiftsMap = new Map<string, ShiftChip>()

  const shouldInclude = (date: string, timeSlotCode: string) => {
    if (!allowed) return true
    return allowed.has(`${date}|${timeSlotCode}`)
  }

  assigned.forEach((shift) => {
    if (!shouldInclude(shift.date, shift.time_slot_code)) return
    const key = `${shift.date}|${shift.time_slot_code}`
    allShiftsMap.set(key, {
      date: shift.date,
      time_slot_code: shift.time_slot_code,
      status: 'assigned',
      classroom_name: shift.classroom_name || null,
      class_name: shift.class_name || null,
    })
  })

  canCover.forEach((shift) => {
    if (!shouldInclude(shift.date, shift.time_slot_code)) return
    const key = `${shift.date}|${shift.time_slot_code}`
    if (!allShiftsMap.has(key)) {
      allShiftsMap.set(key, {
        date: shift.date,
        time_slot_code: shift.time_slot_code,
        status: 'available',
        classroom_name: shift.classroom_name || null,
        class_name: shift.class_name || null,
      })
    }
  })

  cannotCover.forEach((shift) => {
    if (!shouldInclude(shift.date, shift.time_slot_code)) return
    const key = `${shift.date}|${shift.time_slot_code}`
    if (!allShiftsMap.has(key)) {
      allShiftsMap.set(key, {
        date: shift.date,
        time_slot_code: shift.time_slot_code,
        status: 'unavailable',
        reason: shift.reason,
        classroom_name: shift.classroom_name || null,
        class_name: shift.class_name || null,
      })
    }
  })

  return Array.from(allShiftsMap.values()).sort((a, b) => {
    const dateA = parseLocalDate(a.date).getTime()
    const dateB = parseLocalDate(b.date).getTime()
    if (dateA !== dateB) return dateA - dateB
    return a.time_slot_code.localeCompare(b.time_slot_code)
  })
}
