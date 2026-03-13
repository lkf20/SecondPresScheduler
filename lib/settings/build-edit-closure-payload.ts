export interface EditClosureGroup {
  date: string
  closures: Array<{ id: string; time_slot_id: string | null }>
  reason: string | null
  notes: string | null
}

/**
 * Build PATCH body for editing a closure (reason/notes and optionally shape).
 * Same shape -> update_closures; shape change -> delete_closure_ids + add_closures.
 */
export function buildEditClosurePayload(
  editGroup: EditClosureGroup,
  appliesTo: 'all' | 'specific',
  timeSlotIds: string[],
  reasonVal: string | null,
  notesVal: string | null
): {
  update_closures?: Array<{ id: string; reason: string | null; notes: string | null }>
  delete_closure_ids?: string[]
  add_closures?: Array<{
    date: string
    time_slot_id: string | null
    reason: string | null
    notes: string | null
  }>
} {
  const existingIsAll =
    editGroup.closures.length === 1 && editGroup.closures[0].time_slot_id === null
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

  return sameShape
    ? {
        update_closures: editGroup.closures.map(c => ({
          id: c.id,
          reason: reasonVal,
          notes: notesVal,
        })),
      }
    : {
        delete_closure_ids: editGroup.closures.map(c => c.id),
        add_closures:
          appliesTo === 'all'
            ? [
                {
                  date: editGroup.date,
                  time_slot_id: null,
                  reason: reasonVal,
                  notes: notesVal,
                },
              ]
            : timeSlotIds.map(time_slot_id => ({
                date: editGroup.date,
                time_slot_id,
                reason: reasonVal,
                notes: notesVal,
              })),
      }
}
