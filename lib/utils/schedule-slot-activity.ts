import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

type WeeklyScheduleSlot = WeeklyScheduleDataByClassroom['days'][number]['time_slots'][number]

export function isSlotInactive(slot: WeeklyScheduleSlot): boolean {
  return !slot.schedule_cell || slot.schedule_cell.is_active === false
}

export type SlotInactiveReason = 'cell' | 'classroom' | 'time_slot'

type SlotEffectiveActivityInput = {
  schedule_cell?: { is_active?: boolean | null } | null
  classroom_is_active?: boolean | null
  time_slot_is_active?: boolean | null
}

export function getSlotInactiveReasons(input: SlotEffectiveActivityInput): SlotInactiveReason[] {
  const reasons: SlotInactiveReason[] = []

  if (!input.schedule_cell || input.schedule_cell.is_active === false) {
    reasons.push('cell')
  }
  if (input.classroom_is_active === false) {
    reasons.push('classroom')
  }
  if (input.time_slot_is_active === false) {
    reasons.push('time_slot')
  }

  return reasons
}

export function isSlotEffectivelyInactive(input: SlotEffectiveActivityInput): boolean {
  return getSlotInactiveReasons(input).length > 0
}

function hasSlotReferences(slot: WeeklyScheduleSlot): boolean {
  const hasAssignments = (slot.assignments?.length ?? 0) > 0
  const hasAbsences = (slot.absences?.length ?? 0) > 0
  return hasAssignments || hasAbsences
}

/**
 * Returns true when a slot is inactive (or missing its schedule cell) but still has
 * active references that matter operationally (assignments or absences).
 */
export function isInactiveButReferenced(slot: WeeklyScheduleSlot): boolean {
  return isSlotInactive(slot) && hasSlotReferences(slot)
}
