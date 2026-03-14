export interface EditClosureGroup {
  date: string
  closures: Array<{ id: string; time_slot_id: string | null }>
  reason: string | null
  notes: string | null
}

/** Canonical check: whole-day closure group is exactly one closure with time_slot_id === null */
export function isWholeDayClosureGroup(closures: Array<{ time_slot_id: string | null }>): boolean {
  return closures.length === 1 && closures[0].time_slot_id === null
}

/** Item for in-place shape update (preserves row id for audit). */
export interface UpdateClosureShapeItem {
  id: string
  time_slot_id: string | null
  reason: string | null
  notes: string | null
}

/**
 * Build PATCH body for editing a closure (reason/notes and optionally shape).
 * Same shape -> update_closures only.
 * Shape change -> update_closure_shapes (in-place) + delete_closure_ids (surplus) + add_closures (extra slots)
 * so row IDs are preserved where possible and audit entityId links stay valid.
 */
export function buildEditClosurePayload(
  editGroup: EditClosureGroup,
  appliesTo: 'all' | 'specific',
  timeSlotIds: string[],
  reasonVal: string | null,
  notesVal: string | null
): {
  update_closures?: Array<{ id: string; reason: string | null; notes: string | null }>
  update_closure_shapes?: UpdateClosureShapeItem[]
  delete_closure_ids?: string[]
  add_closures?: Array<{
    date: string
    time_slot_id: string | null
    reason: string | null
    notes: string | null
  }>
} {
  const existingIsAll = isWholeDayClosureGroup(editGroup.closures)
  const existingSlotIds = editGroup.closures
    .map(c => c.time_slot_id)
    .filter((id): id is string => id != null)
    .sort()
  const newIsAll = appliesTo === 'all'
  const newSlotIds = newIsAll ? [] : [...timeSlotIds].sort()
  const sameShape =
    (existingIsAll && newIsAll) ||
    (!existingIsAll &&
      !newIsAll &&
      existingSlotIds.length === newSlotIds.length &&
      existingSlotIds.every((id, i) => id === newSlotIds[i]))

  if (sameShape) {
    return {
      update_closures: editGroup.closures.map(c => ({
        id: c.id,
        reason: reasonVal,
        notes: notesVal,
      })),
    }
  }

  // Shape change: pair existing rows with new slots for in-place updates; delete surplus, add extras.
  const existingSorted = [...editGroup.closures].sort((a, b) => {
    if (a.time_slot_id == null) return -1
    if (b.time_slot_id == null) return 1
    return (a.time_slot_id as string).localeCompare(b.time_slot_id as string)
  })
  const newSlots: (string | null)[] = newIsAll ? [null] : newSlotIds.map(s => s)

  const minLen = Math.min(existingSorted.length, newSlots.length)
  const update_closure_shapes: UpdateClosureShapeItem[] = []
  for (let i = 0; i < minLen; i++) {
    update_closure_shapes.push({
      id: existingSorted[i].id,
      time_slot_id: newSlots[i],
      reason: reasonVal,
      notes: notesVal,
    })
  }
  const delete_closure_ids =
    existingSorted.length > minLen ? existingSorted.slice(minLen).map(c => c.id) : undefined
  const add_closures =
    newSlots.length > minLen
      ? newSlots.slice(minLen).map(time_slot_id => ({
          date: editGroup.date,
          time_slot_id,
          reason: reasonVal,
          notes: notesVal,
        }))
      : undefined

  return {
    ...(update_closure_shapes.length > 0 ? { update_closure_shapes } : {}),
    ...(delete_closure_ids?.length ? { delete_closure_ids } : {}),
    ...(add_closures?.length ? { add_closures } : {}),
  }
}
