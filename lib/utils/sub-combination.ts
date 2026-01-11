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
  // Filter to only subs with coverage_percent > 0
  const eligibleSubs = subs.filter((sub) => sub.coverage_percent > 0)

  if (eligibleSubs.length === 0) {
    return null
  }

  // Get all uncovered shifts
  const uncoveredShifts = getUncoveredShifts(eligibleSubs)

  if (uncoveredShifts.size === 0) {
    return null
  }

  // Build shift map: shiftKey -> shift details (from first sub that has it)
  const shiftMap = new Map<string, Shift>()
  eligibleSubs.forEach((sub) => {
    sub.can_cover?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      if (uncoveredShifts.has(shiftKey) && !shiftMap.has(shiftKey)) {
        shiftMap.set(shiftKey, shift)
      }
    })
  })

  // Build sub-to-shifts map with conflict calculations
  const subShiftsMap = new Map<string, SubShiftCoverage>()

  eligibleSubs.forEach((sub) => {
    const availableShifts = new Map<string, Shift>()
    const conflicts = new Map<string, number>()

    sub.can_cover?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      // Only include uncovered shifts
      if (uncoveredShifts.has(shiftKey)) {
        availableShifts.set(shiftKey, shift)

        // Calculate conflicts for this shift
        const shiftConflicts = calculateShiftConflicts(shift, sub)
        let conflictCount = 0
        if (shiftConflicts.missingDiaperChanging) conflictCount++
        if (shiftConflicts.missingLifting) conflictCount++
        if (shiftConflicts.missingQualification) conflictCount++
        conflicts.set(shiftKey, conflictCount)
      }
    })

    if (availableShifts.size > 0) {
      subShiftsMap.set(sub.id, { sub, availableShifts, conflicts })
    }
  })

  // Greedy algorithm: repeatedly select the sub that covers the most uncovered shifts
  // with the least conflicts, breaking ties by preferring fewer total conflicts
  const selectedSubs = new Set<string>()
  const coveredShifts = new Set<string>()
  const assignments: SubAssignment[] = []

  while (coveredShifts.size < uncoveredShifts.size) {
    let bestSubId: string | null = null
    let bestNewCoverage = 0
    let bestConflicts = Infinity
    let bestSubData: SubShiftCoverage | null = null

    // Find the sub that adds the most uncovered shifts with least conflicts
    subShiftsMap.forEach((data, subId) => {
      if (selectedSubs.has(subId)) return

      // Count new shifts this sub would cover
      let newCoverage = 0
      let newConflicts = 0

      data.availableShifts.forEach((shift, shiftKey) => {
        if (!coveredShifts.has(shiftKey)) {
          newCoverage++
          newConflicts += data.conflicts.get(shiftKey) || 0
        }
      })

      // Skip if no new coverage
      if (newCoverage === 0) return

      // Prioritize: more coverage is better, but if coverage is equal, prefer fewer conflicts
      const isBetter =
        newCoverage > bestNewCoverage ||
        (newCoverage === bestNewCoverage && newConflicts < bestConflicts)

      if (isBetter) {
        bestSubId = subId
        bestNewCoverage = newCoverage
        bestConflicts = newConflicts
        bestSubData = data
      }
    })

    // If no sub can add coverage, we're done (partial solution)
    if (!bestSubId || !bestSubData) break

    // Add this sub to the combination
    selectedSubs.add(bestSubId)
    const shiftsForSub: Shift[] = []
    let missingDiaperChanging = 0
    let missingLifting = 0
    let missingQualifications = 0

    bestSubData.availableShifts.forEach((shift, shiftKey) => {
      if (!coveredShifts.has(shiftKey)) {
        coveredShifts.add(shiftKey)
        shiftsForSub.push(shift)

        // Count conflicts
        const shiftConflicts = calculateShiftConflicts(shift, bestSubData.sub)
        if (shiftConflicts.missingDiaperChanging) missingDiaperChanging++
        if (shiftConflicts.missingLifting) missingLifting++
        if (shiftConflicts.missingQualification) missingQualifications++
      }
    })

    // Calculate coverage for this sub (remaining shifts they can cover, excluding assigned shifts)
    const subShiftsCovered = shiftsForSub.length
    // Count how many of the sub's can_cover shifts are still uncovered (not assigned to anyone)
    let remainingShifts = 0
    bestSubData.sub.can_cover?.forEach((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      if (uncoveredShifts.has(shiftKey)) {
        remainingShifts++
      }
    })
    const subTotalShifts = remainingShifts > 0 ? remainingShifts : 0
    const subCoveragePercent = subTotalShifts > 0 
      ? Math.round((subShiftsCovered / subTotalShifts) * 100)
      : 0

    assignments.push({
      subId: bestSubData.sub.id,
      subName: bestSubData.sub.name,
      phone: bestSubData.sub.phone || null,
      shifts: shiftsForSub,
      shiftsCovered: subShiftsCovered,
      totalShifts: subTotalShifts,
      coveragePercent: subCoveragePercent,
      conflicts: {
        missingDiaperChanging,
        missingLifting,
        missingQualifications,
        total: missingDiaperChanging + missingLifting + missingQualifications,
      },
    })
  }

  // Calculate totals
  const totalConflicts = assignments.reduce((sum, assignment) => sum + assignment.conflicts.total, 0)

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
