export function reconcileSelectedIdsWithAvailable(
  selectedIds: string[],
  availableIds: string[]
): string[] {
  if (availableIds.length === 0) return selectedIds
  const availableSet = new Set(availableIds)
  const validSelected = selectedIds.filter(id => availableSet.has(id))
  const hadInvalidIds = validSelected.length !== selectedIds.length
  if (!hadInvalidIds) return selectedIds

  const shouldTreatAsAllSelected = selectedIds.length >= availableIds.length
  return shouldTreatAsAllSelected ? availableIds : validSelected
}

export function includeNewIdsWhenPreviouslyAllSelected(
  selectedIds: string[],
  previousAvailableIds: string[] | null,
  currentAvailableIds: string[]
): string[] {
  if (currentAvailableIds.length === 0) return selectedIds

  const previousAvailable = previousAvailableIds ?? currentAvailableIds
  const previousAvailableSet = new Set(previousAvailable)
  const selectedSet = new Set(selectedIds)

  const hadAllPreviouslyAvailableSelected =
    previousAvailable.length > 0 && previousAvailable.every(id => selectedSet.has(id))
  if (!hadAllPreviouslyAvailableSelected) return selectedIds

  const newlyAddedIds = currentAvailableIds.filter(id => !previousAvailableSet.has(id))
  if (newlyAddedIds.length === 0) return selectedIds

  const nextSet = new Set(selectedIds)
  newlyAddedIds.forEach(id => nextSet.add(id))
  return Array.from(nextSet)
}
