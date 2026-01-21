interface Sub {
  id: string
  name: string
  phone: string | null
  coverage_percent: number
  shifts_covered?: number
  total_shifts?: number
  can_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    class_name: string | null
    diaper_changing_required?: boolean
    lifting_children_required?: boolean
  }>
  assigned_shifts?: Array<{
    date: string
    day_name: string
    time_slot_code: string
  }>
  can_change_diapers?: boolean
  can_lift_children?: boolean
  qualification_matches: number
  qualification_total: number
}

interface Shift {
  date: string
  day_name: string
  time_slot_code: string
  class_name: string | null
  diaper_changing_required?: boolean
  lifting_children_required?: boolean
}

export interface SubAssignment {
  subId: string
  subName: string
  phone: string | null
  shifts: Shift[]
  shiftsCovered: number
  totalShifts: number
  coveragePercent: number
  conflicts: {
    missingDiaperChanging: number
    missingLifting: number
    missingQualifications: number
    total: number
  }
}

export interface RecommendedCombination {
  subs: SubAssignment[]
  totalShiftsCovered: number
  totalShiftsNeeded: number
  totalConflicts: number
  coveragePercent: number
}

type SubShiftCoverage = {
  sub: Sub
  availableShifts: Map<string, Shift>
  conflicts: Map<string, number>
}

/**
 * Calculate conflicts for a sub covering a specific shift
 */
function calculateShiftConflicts(
  shift: Shift,
  sub: Sub
): { missingDiaperChanging: boolean; missingLifting: boolean; missingQualification: boolean } {
  const missingDiaperChanging =
    shift.diaper_changing_required === true && sub.can_change_diapers !== true
  const missingLifting =
    shift.lifting_children_required === true && sub.can_lift_children !== true
  // For qualifications, we use the sub's overall qualification match rate
  // If they have any qualification mismatches, count it as a conflict for this shift
  const missingQualification = sub.qualification_total > 0 && sub.qualification_matches < sub.qualification_total

  return {
    missingDiaperChanging,
    missingLifting,
    missingQualification,
  }
}

/**
 * Get all shifts that need coverage (excluding already assigned shifts)
 */
function getUncoveredShifts(subs: Sub[]): Set<string> {
  const allShifts = new Set<string>()
  const assignedShifts = new Set<string>()

  // Collect all shifts from can_cover
  subs.forEach((sub) => {
    sub.can_cover?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      allShifts.add(shiftKey)
    })
  })

  // Collect all assigned shifts
  subs.forEach((sub) => {
    sub.assigned_shifts?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      assignedShifts.add(shiftKey)
    })
  })

  // Return only uncovered shifts
  const uncovered = new Set<string>()
  allShifts.forEach((shiftKey) => {
    if (!assignedShifts.has(shiftKey)) {
      uncovered.add(shiftKey)
    }
  })

  return uncovered
}

/**
 * Find the best combination of subs to cover all shifts with minimum conflicts
 * Uses a greedy algorithm that prioritizes subs with best conflict-to-coverage ratio
 */
export function findBestCombination(subs: Sub[]): RecommendedCombination | null {
  const combos = findTopCombinations(subs, 1)
  return combos[0] ?? null
}

function buildCombinationFromSubs(
  selectedSubs: Sub[],
  uncoveredShifts: Set<string>
): RecommendedCombination | null {
  if (selectedSubs.length === 0 || uncoveredShifts.size === 0) return null

  const selectedShiftMap = new Map<string, Shift>()
  selectedSubs.forEach((sub) => {
    sub.can_cover?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      if (uncoveredShifts.has(shiftKey) && !selectedShiftMap.has(shiftKey)) {
        selectedShiftMap.set(shiftKey, shift)
      }
    })
  })

  const subCoverage = new Map<string, SubShiftCoverage>()
  selectedSubs.forEach((sub) => {
    const availableShifts = new Map<string, Shift>()
    const conflicts = new Map<string, number>()

    sub.can_cover?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      if (uncoveredShifts.has(shiftKey)) {
        availableShifts.set(shiftKey, shift)
        const shiftConflicts = calculateShiftConflicts(shift, sub)
        let conflictCount = 0
        if (shiftConflicts.missingDiaperChanging) conflictCount++
        if (shiftConflicts.missingLifting) conflictCount++
        if (shiftConflicts.missingQualification) conflictCount++
        conflicts.set(shiftKey, conflictCount)
      }
    })

    if (availableShifts.size > 0) {
      subCoverage.set(sub.id, { sub, availableShifts, conflicts })
    }
  })

  const assignmentsBySub = new Map<string, Shift[]>()
  const coveredShifts = new Set<string>()

  for (const shiftKey of uncoveredShifts) {
    let bestSub: SubShiftCoverage | null = null
    let bestConflicts = Infinity
    let bestCoveragePercent = -1

    subCoverage.forEach((data: SubShiftCoverage) => {
      if (!data.availableShifts.has(shiftKey)) return
      const conflictCount = data.conflicts.get(shiftKey) ?? 0
      if (
        conflictCount < bestConflicts ||
        (conflictCount === bestConflicts &&
          (data.sub.coverage_percent ?? 0) > bestCoveragePercent)
      ) {
        bestSub = data
        bestConflicts = conflictCount
        bestCoveragePercent = data.sub.coverage_percent ?? 0
      }
    })

    if (!bestSub) {
      return null
    }

    // TypeScript type narrowing - bestSub is guaranteed to be non-null here
    const bestSubData: SubShiftCoverage = bestSub
    const shift = bestSubData.availableShifts.get(shiftKey) ?? selectedShiftMap.get(shiftKey)
    if (!shift) {
      return null
    }

    const assigned = assignmentsBySub.get(bestSubData.sub.id) || []
    assigned.push(shift)
    assignmentsBySub.set(bestSubData.sub.id, assigned)
    coveredShifts.add(shiftKey)
  }

  const assignments: SubAssignment[] = []
  let totalConflicts = 0

  selectedSubs.forEach((sub) => {
    const shifts = assignmentsBySub.get(sub.id) || []
    if (shifts.length === 0) return

    let missingDiaperChanging = 0
    let missingLifting = 0
    let missingQualifications = 0

    shifts.forEach((shift) => {
      const shiftConflicts = calculateShiftConflicts(shift, sub)
      if (shiftConflicts.missingDiaperChanging) missingDiaperChanging++
      if (shiftConflicts.missingLifting) missingLifting++
      if (shiftConflicts.missingQualification) missingQualifications++
    })

    let remainingShifts = 0
    sub.can_cover?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      if (uncoveredShifts.has(shiftKey)) {
        remainingShifts++
      }
    })
    const totalShifts = remainingShifts > 0 ? remainingShifts : 0
    const coveragePercent = totalShifts > 0 ? Math.round((shifts.length / totalShifts) * 100) : 0

    const conflictsTotal = missingDiaperChanging + missingLifting + missingQualifications
    totalConflicts += conflictsTotal

    assignments.push({
      subId: sub.id,
      subName: sub.name,
      phone: sub.phone || null,
      shifts,
      shiftsCovered: shifts.length,
      totalShifts,
      coveragePercent,
      conflicts: {
        missingDiaperChanging,
        missingLifting,
        missingQualifications,
        total: conflictsTotal,
      },
    })
  })

  return {
    subs: assignments,
    totalShiftsCovered: coveredShifts.size,
    totalShiftsNeeded: uncoveredShifts.size,
    totalConflicts,
    coveragePercent:
      uncoveredShifts.size > 0
        ? Math.round((coveredShifts.size / uncoveredShifts.size) * 100)
        : 100,
  }
}

export function findTopCombinations(subs: Sub[], limit = 5): RecommendedCombination[] {
  // Filter to only subs with coverage_percent > 0
  const eligibleSubs = subs.filter((sub) => sub.coverage_percent > 0)

  if (eligibleSubs.length === 0) {
    return []
  }

  // Get all uncovered shifts
  const uncoveredShifts = getUncoveredShifts(eligibleSubs)

  if (uncoveredShifts.size === 0) {
    return []
  }

  const subsWithCoverage = eligibleSubs
    .map((sub) => {
      const coverage = new Set<string>()
      sub.can_cover?.forEach((shift) => {
        const key = `${shift.date}|${shift.time_slot_code}`
        if (uncoveredShifts.has(key)) {
          coverage.add(key)
        }
      })
      return { sub, coverage }
    })
    .filter((entry) => entry.coverage.size > 0)
    .sort((a, b) => {
      if (b.coverage.size !== a.coverage.size) return b.coverage.size - a.coverage.size
      return (b.sub.coverage_percent ?? 0) - (a.sub.coverage_percent ?? 0)
    })

  const targetCount = uncoveredShifts.size
  const results: RecommendedCombination[] = []
  const seen = new Set<string>()

  const dfs = (startIndex: number, selected: Sub[], covered: Set<string>) => {
    if (results.length >= limit) return
    if (covered.size === targetCount) {
      const combo = buildCombinationFromSubs(selected, uncoveredShifts)
      if (combo && combo.totalShiftsCovered === targetCount) {
        const key = combo.subs.map((assignment) => assignment.subId).sort().join('|')
        if (!seen.has(key)) {
          seen.add(key)
          results.push(combo)
        }
      }
      return
    }

    for (let i = startIndex; i < subsWithCoverage.length; i++) {
      if (results.length >= limit) return
      const entry = subsWithCoverage[i]
      const nextCovered = new Set(covered)
      entry.coverage.forEach((shiftKey) => nextCovered.add(shiftKey))
      if (nextCovered.size === covered.size) continue
      dfs(i + 1, [...selected, entry.sub], nextCovered)
    }
  }

  dfs(0, [], new Set())

  return results
    .sort((a, b) => {
      if (a.totalConflicts !== b.totalConflicts) return a.totalConflicts - b.totalConflicts
      if (a.subs.length !== b.subs.length) return a.subs.length - b.subs.length
      return b.totalShiftsCovered - a.totalShiftsCovered
    })
    .slice(0, limit)
}
