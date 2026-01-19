'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useSubFinderAbsences } from '@/lib/hooks/use-sub-finder-absences'
import { useSubRecommendations } from '@/lib/hooks/use-sub-recommendations'
import type { RecommendedCombination } from '@/lib/utils/sub-combination'
export type Mode = 'existing' | 'manual'

export interface Absence {
  id: string
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  reason: string | null
  classrooms?: Array<{
    id: string
    name: string
    color: string | null
  }>
  shifts: {
      total: number
      uncovered: number
      partially_covered: number
      fully_covered: number
      shift_details: Array<{
        id: string
        date: string
        day_name: string
        time_slot_code: string
        class_name: string | null
        classroom_name: string | null
        status: 'uncovered' | 'partially_covered' | 'fully_covered'
        sub_name?: string | null
        is_partial?: boolean
      }>
      shift_details_sorted?: Array<{
        id: string
        date: string
        day_name: string
        time_slot_code: string
        status: 'uncovered' | 'partially_covered' | 'fully_covered'
        sub_name?: string | null
        is_partial?: boolean
      }>
      coverage_segments?: Array<{
        id: string
        status: 'uncovered' | 'partially_covered' | 'fully_covered'
      }>
    }
  }

export interface Teacher {
  id: string
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  active?: boolean | null
}

export interface SubCandidate {
  id: string
  coverage_percent: number
  shifts_covered?: number
  can_cover?: unknown[]
  assigned_shifts?: Array<{ date: string; time_slot_code: string }>
  remaining_shift_keys?: string[]
  remaining_shift_count?: number
  has_assigned_shifts?: boolean
  shift_chips?: Array<{
    date: string
    time_slot_code: string
    status: 'assigned' | 'available' | 'unavailable'
    reason?: string
    classroom_name?: string | null
    class_name?: string | null
  }>
  [key: string]: unknown
}

interface ManualFindInput {
  teacherId: string
  startDate: string
  endDate: string
  shifts: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
}

export function useSubFinderData({
  mode,
  requestedAbsenceId,
  skipInitialFetch = false,
}: {
  mode: Mode
  requestedAbsenceId: string | null
  skipInitialFetch?: boolean
}) {
  const hasAppliedAbsenceRef = useRef(false)
  const hasSkippedInitialFetchRef = useRef(skipInitialFetch)
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null)
  const [recommendedSubs, setRecommendedSubs] = useState<SubCandidate[]>([])
  const [allSubs, setAllSubs] = useState<SubCandidate[]>([])
  const [recommendedCombinations, setRecommendedCombinations] = useState<RecommendedCombination[]>([])
  const [includePartiallyCovered, setIncludePartiallyCovered] = useState(false)
  const [includeFlexibleStaff, setIncludeFlexibleStaff] = useState(true)
  const [includeOnlyRecommended, setIncludeOnlyRecommended] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  
  // Use React Query for absences
  const { 
    data: absencesData = [], 
    isLoading: isLoadingAbsences,
    refetch: refetchAbsences 
  } = useSubFinderAbsences(
    { includePartiallyCovered },
    skipInitialFetch ? undefined : [] // Don't provide initial data if skipping fetch
  )
  
  // Transform API response to match component's expected Absence format
  const transformedAbsences: Absence[] = useMemo(() => {
    return absencesData.map((apiAbsence: any) => ({
      id: apiAbsence.id,
      teacher_id: apiAbsence.teacher_id,
      teacher_name: apiAbsence.teacher_name,
      start_date: apiAbsence.start_date,
      end_date: apiAbsence.end_date,
      reason: apiAbsence.reason,
      classrooms: apiAbsence.classrooms,
      shifts: {
        total: apiAbsence.shifts?.total || 0,
        uncovered: apiAbsence.shifts?.uncovered || 0,
        partially_covered: apiAbsence.shifts?.partial || 0,
        fully_covered: apiAbsence.shifts?.covered || 0,
        shift_details: (apiAbsence.shifts?.shift_details || []).map((detail: any) => ({
          id: detail.id || '',
          date: detail.date,
          day_name: detail.day_name,
          time_slot_code: detail.time_slot_code,
          class_name: detail.class_name || null,
          classroom_name: detail.classroom_name || null,
          status: detail.status === 'partial' ? 'partially_covered' : 
                 detail.status === 'covered' ? 'fully_covered' : 
                 'uncovered',
          sub_name: detail.assigned_sub?.name || null,
          is_partial: detail.status === 'partial',
        })),
      },
    }))
  }, [absencesData])
  
  // Support state restoration - allow setting absences from sessionStorage
  const [restoredAbsences, setRestoredAbsences] = useState<Absence[] | null>(null)
  const [shouldUseRestoredAbsences, setShouldUseRestoredAbsences] = useState(false)
  
  // Use restored absences if available and we're in restoration mode, otherwise use React Query data
  // Once restoration is complete, we can merge/update with React Query data
  const absences = useMemo(() => {
    if (shouldUseRestoredAbsences && restoredAbsences && restoredAbsences.length > 0) {
      console.log('[useSubFinderData] Using restored absences:', restoredAbsences.length)
      return restoredAbsences
    }
    console.log('[useSubFinderData] Using transformed absences from React Query:', transformedAbsences.length)
    return transformedAbsences
  }, [restoredAbsences, transformedAbsences, shouldUseRestoredAbsences])
  
  // Use React Query for sub recommendations when an absence is selected
  const selectedAbsenceId = selectedAbsence?.id && selectedAbsence.id.startsWith('manual-') 
    ? null // Manual coverage doesn't use the recommendations API
    : selectedAbsence?.id || null
  
  const { 
    data: subRecommendationsData,
    isLoading: isLoadingRecommendations,
    refetch: refetchRecommendations
  } = useSubRecommendations(
    selectedAbsenceId,
    { includeFlexibleStaff }
  )
  
  const loading = isLoadingAbsences || isLoadingRecommendations

  const getDisplayName = useCallback(
    (
      person: {
        display_name?: string | null
        name?: string | null
        first_name?: string | null
        last_name?: string | null
      } | null | undefined,
      fallback = 'Unknown'
    ) => {
      const name = (person?.display_name || person?.name || `${person?.first_name ?? ''} ${person?.last_name ?? ''}`).trim()
      return name || fallback
    },
    []
  )

  const applySubResults = useCallback(
    (
      subs: SubCandidate[],
      options: { forceOnlyRecommended?: boolean; useOnlyRecommended?: boolean } = {}
    ) => {
      const { forceOnlyRecommended = false, useOnlyRecommended } = options
      setAllSubs(subs)
      const effectiveOnlyRecommended =
        typeof useOnlyRecommended === 'boolean'
          ? useOnlyRecommended
          : forceOnlyRecommended
            ? true
            : includeOnlyRecommended
      if (forceOnlyRecommended) {
        setIncludeOnlyRecommended(true)
      }
      setRecommendedSubs(
        effectiveOnlyRecommended ? subs.filter((sub) => sub.coverage_percent > 0) : subs
      )
    },
    [includeOnlyRecommended]
  )
  
  // Update recommended subs and combinations when recommendations data changes
  useEffect(() => {
    if (subRecommendationsData && selectedAbsenceId) {
      const subs = (subRecommendationsData.subs || []) as SubCandidate[]
      const combinations = subRecommendationsData.combinations || []
      setRecommendedCombinations(combinations)
      applySubResults(subs)
    }
  }, [subRecommendationsData, selectedAbsenceId, applySubResults])

  // Fetch absences using React Query - just trigger refetch
  const fetchAbsences = useCallback(async () => {
    await refetchAbsences()
  }, [refetchAbsences])

  const handleFindSubs = useCallback(
    async (absence: Absence) => {
      setSelectedAbsence(absence)
      // React Query will automatically fetch recommendations when selectedAbsenceId changes
      // Just trigger a refetch to ensure we get fresh data
      if (absence.id && !absence.id.startsWith('manual-')) {
        await refetchRecommendations()
      }
    },
    [refetchRecommendations]
  )

  const handleFindManualSubs = useCallback(
    async ({ teacherId, startDate, endDate, shifts }: ManualFindInput) => {
      if (!teacherId || !startDate) return
      // Manual coverage doesn't use React Query - it's a one-off search
      const teacher = teachers.find((t) => t.id === teacherId)
      const teacherName = getDisplayName(teacher, 'Manual Coverage')
      setSelectedAbsence({
        id: `manual-${teacherId}`,
        teacher_id: teacherId,
        teacher_name: teacherName,
        start_date: startDate,
        end_date: endDate,
        reason: null,
        shifts: {
          total: 0,
          uncovered: 0,
          partially_covered: 0,
          fully_covered: 0,
          shift_details: [],
        },
      })
      setRecommendedSubs([])
      setAllSubs([])
      setRecommendedCombinations([])
      try {
        const response = await fetch('/api/sub-finder/find-subs-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_id: teacherId,
            start_date: startDate,
            end_date: endDate,
            shifts,
          }),
        })
        if (!response.ok) throw new Error('Failed to find subs')
        const data = await response.json()
        const shiftDetails = data.shift_details || []
        const totals = data.totals || {
          total: shiftDetails.length,
          uncovered: shiftDetails.length,
          partially_covered: 0,
          fully_covered: 0,
        }

        setSelectedAbsence({
          id: `manual-${teacherId}`,
          teacher_id: teacherId,
          teacher_name: teacherName,
          start_date: startDate,
          end_date: endDate,
          reason: null,
          shifts: {
            total: totals.total,
            uncovered: totals.uncovered,
            partially_covered: totals.partially_covered,
            fully_covered: totals.fully_covered,
            shift_details: shiftDetails,
          },
        })

        const subs = (data.subs || []) as SubCandidate[]
        const combinations = data.recommended_combinations || (data.recommended_combination ? [data.recommended_combination] : [])
        setRecommendedCombinations(combinations)
        applySubResults(subs, { forceOnlyRecommended: true })
      } catch (error) {
        console.error('Error finding subs (manual):', error)
      }
    },
    [applySubResults, getDisplayName, teachers]
  )

  // React Query automatically refetches when includePartiallyCovered changes
  // No manual useEffect needed

  useEffect(() => {
    if (!requestedAbsenceId) return
    if (hasAppliedAbsenceRef.current) return
    if (absences.length === 0) return
    const match = absences.find((absence) => absence.id === requestedAbsenceId)
    if (match) {
      handleFindSubs(match).catch((error) => {
        console.error('Failed to load requested absence:', error)
      })
      hasAppliedAbsenceRef.current = true
    }
  }, [requestedAbsenceId, absences, handleFindSubs])
  
  // Expose setAbsences for state restoration (sessionStorage)
  const setAbsences = useCallback((newAbsences: Absence[]) => {
    // Used for state restoration from sessionStorage
    // This temporarily overrides React Query data until restoration is complete
    console.log('[useSubFinderData] Setting restored absences:', newAbsences.length)
    setRestoredAbsences(newAbsences)
    setShouldUseRestoredAbsences(true)
  }, [])
  
  // Expose function to stop using restored absences (after restoration is complete)
  const clearRestoredAbsences = useCallback(() => {
    console.log('[useSubFinderData] Clearing restored absences, switching to React Query data')
    setShouldUseRestoredAbsences(false)
    setRestoredAbsences(null)
  }, [])

  useEffect(() => {
    if (allSubs.length > 0 && selectedAbsence) {
      applySubResults(allSubs)
    } else if (!selectedAbsence) {
      setRecommendedCombinations([])
    }
  }, [includeOnlyRecommended, selectedAbsence, allSubs, applySubResults])

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const response = await fetch('/api/teachers')
        if (!response.ok) throw new Error('Failed to fetch teachers')
        const data = await response.json()
        const sortedTeachers = (data as Teacher[])
          .filter((teacher) => teacher.active !== false)
          .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
        setTeachers(sortedTeachers)
      } catch (error) {
        console.error('Error fetching teachers:', error)
        setTeachers([])
      }
    }

    fetchTeachers()
  }, [getDisplayName])

  return {
    absences,
    setAbsences,
    clearRestoredAbsences,
    selectedAbsence,
    setSelectedAbsence,
    recommendedSubs,
    allSubs,
    recommendedCombinations,
    setRecommendedCombinations,
    loading,
    includePartiallyCovered,
    setIncludePartiallyCovered,
    includeFlexibleStaff,
    setIncludeFlexibleStaff,
    includeOnlyRecommended,
    setIncludeOnlyRecommended,
    teachers,
    getDisplayName,
    fetchAbsences,
    handleFindSubs,
    handleFindManualSubs,
    applySubResults,
  }
}
