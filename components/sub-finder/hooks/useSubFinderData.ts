'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useSubFinderAbsences, type SubFinderAbsence } from '@/lib/hooks/use-sub-finder-absences'
import { useSubRecommendations } from '@/lib/hooks/use-sub-recommendations'
import type { RecommendedCombination } from '@/lib/utils/sub-combination'
import type { SubRecommendationsQueryParams } from '@/lib/utils/query-keys'
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
  name: string
  display_name?: string | null
  first_name?: string | null
  last_name?: string | null
  phone: string | null
  email: string | null
  coverage_percent: number
  shifts_covered: number
  total_shifts: number
  can_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    class_name: string | null
    classroom_name?: string | null
  }>
  cannot_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    reason: string
    classroom_name?: string | null
  }>
  assigned_shifts?: Array<{
    date: string
    day_name: string
    time_slot_code: string
    classroom_name?: string | null
  }>
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
  notes?: string | null
  response_status?: string | null
  [key: string]: unknown
}

interface ManualFindInput {
  teacherId: string
  startDate: string
  endDate: string
  shifts: Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
}

export function useSubFinderData({
  requestedAbsenceId,
  skipInitialFetch = false,
  subRecommendationParams,
}: {
  requestedAbsenceId: string | null
  skipInitialFetch?: boolean
  subRecommendationParams?: SubRecommendationsQueryParams
}) {
  const hasAppliedAbsenceRef = useRef(false)
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
    isFetching: isFetchingAbsences,
    refetch: refetchAbsences 
  } = useSubFinderAbsences(
    { includePartiallyCovered },
    skipInitialFetch ? undefined : [] // Don't provide initial data if skipping fetch
  )

  const mapAbsence = useCallback((apiAbsence: SubFinderAbsence): Absence => ({
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
      partially_covered: apiAbsence.shifts?.partial ?? apiAbsence.shifts?.partially_covered ?? 0,
      fully_covered: apiAbsence.shifts?.covered ?? apiAbsence.shifts?.fully_covered ?? 0,
      shift_details: (apiAbsence.shifts?.shift_details || []).map((detail) => ({
        id: detail.id || '',
        date: detail.date,
        day_name: detail.day_name,
        time_slot_code: detail.time_slot_code,
        class_name: detail.class_name || null,
        classroom_name: detail.classroom_name || null,
        status:
          detail.status === 'partial' || detail.status === 'partially_covered'
            ? 'partially_covered'
            : detail.status === 'covered' || detail.status === 'fully_covered'
              ? 'fully_covered'
              : 'uncovered',
        sub_name: detail.assigned_sub?.name || null,
        is_partial: detail.status === 'partial' || detail.status === 'partially_covered',
      })),
    },
  }), [])

  const transformedAbsences: Absence[] = useMemo(() => {
    return absencesData.map(mapAbsence)
  }, [absencesData, mapAbsence])

  const absences = useMemo(() => {
    return transformedAbsences
  }, [transformedAbsences])
  
  // Use React Query for sub recommendations when an absence is selected
  const selectedAbsenceId = selectedAbsence?.id && selectedAbsence.id.startsWith('manual-') 
    ? null // Manual coverage doesn't use the recommendations API
    : selectedAbsence?.id || null
  
  const recommendationParams = useMemo(
    () => ({
      ...(subRecommendationParams || {}),
      includeFlexibleStaff,
    }),
    [includeFlexibleStaff, subRecommendationParams]
  )

  const { 
    data: subRecommendationsData,
    isLoading: isLoadingRecommendations,
    isFetching: isFetchingRecommendations,
    refetch: refetchRecommendations
  } = useSubRecommendations(
    selectedAbsenceId,
    recommendationParams
  )
  
  const loading =
    isLoadingAbsences ||
    isLoadingRecommendations ||
    isFetchingAbsences ||
    isFetchingRecommendations

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
      const subs = (subRecommendationsData.subs || []) as unknown as SubCandidate[]
      // Note: API combinations structure doesn't match RecommendedCombination, so we skip it
      // The combinations will be calculated by the sub-combination utility if needed
      setRecommendedCombinations([])
      applySubResults(subs)
    }
  }, [subRecommendationsData, selectedAbsenceId, applySubResults])

  // Fetch absences using React Query - just trigger refetch
  const fetchAbsences = useCallback(async () => {
    await refetchAbsences()
  }, [refetchAbsences])

  const handleFindSubs = useCallback(
    async (absence: Absence) => {
      const isManual = absence.id.startsWith('manual-')
      const isNewAbsence = selectedAbsence?.id !== absence.id
      const absenceId = absence.id
      setSelectedAbsence(absence)
      if (isNewAbsence) {
        setRecommendedSubs([])
        setAllSubs([])
        setRecommendedCombinations([])
      }
      if (!isManual) {
        const [absencesResult] = await Promise.all([refetchAbsences(), refetchRecommendations()])
        const refreshedAbsence = absencesResult.data?.find((item) => item.id === absenceId)
        if (refreshedAbsence) {
          setSelectedAbsence(mapAbsence(refreshedAbsence))
        }
      }
    },
    [refetchAbsences, refetchRecommendations, selectedAbsence?.id, mapAbsence]
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
    
    // Ensure absences are loaded
    if (isLoadingAbsences) {
      // Wait for absences to load
      return
    }
    
    // If absences haven't loaded yet and we have a requested absence, fetch them
    if (absences.length === 0 && !isLoadingAbsences) {
      refetchAbsences()
      return
    }
    
    // Once absences are loaded, find and select the requested absence
    const match = absences.find((absence) => absence.id === requestedAbsenceId)
    if (match) {
      handleFindSubs(match).catch((error) => {
        console.error('Failed to load requested absence:', error)
      })
      hasAppliedAbsenceRef.current = true
    }
  }, [requestedAbsenceId, absences, isLoadingAbsences, handleFindSubs, refetchAbsences])
  
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
