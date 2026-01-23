/**
 * Utility for preserving Sub Finder state across navigation
 * Uses sessionStorage to persist state during the browser session
 */

export interface SubFinderState {
  // Mode
  mode: 'existing' | 'manual'

  // Selected teachers (for existing absences mode)
  selectedTeacherIds: string[]

  // Selected absence (for existing absences mode)
  selectedAbsenceId: string | null

  // Manual coverage state
  manualTeacherId: string
  manualStartDate: string
  manualEndDate: string
  manualSelectedShifts: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>

  // Filter options
  includePartiallyCovered: boolean
  includeFlexibleStaff: boolean
  includeOnlyRecommended: boolean
  includePastShifts: boolean
  subSearch: string
}

const STORAGE_KEY = 'sub-finder-state'

export function saveSubFinderState(state: Partial<SubFinderState>): void {
  try {
    const existing = loadSubFinderState()
    const merged = { ...existing, ...state }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch (error) {
    console.error('Error saving Sub Finder state:', error)
  }
}

export function loadSubFinderState(): Partial<SubFinderState> | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as Partial<SubFinderState>
  } catch (error) {
    console.error('Error loading Sub Finder state:', error)
    return null
  }
}

export function clearSubFinderState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing Sub Finder state:', error)
  }
}
