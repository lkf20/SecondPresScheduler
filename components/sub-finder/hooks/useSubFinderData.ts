'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
}: {
  mode: Mode
  requestedAbsenceId: string | null
}) {
  const hasAppliedAbsenceRef = useRef(false)
  const [absences, setAbsences] = useState<Absence[]>([])
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null)
  const [recommendedSubs, setRecommendedSubs] = useState<SubCandidate[]>([])
  const [allSubs, setAllSubs] = useState<SubCandidate[]>([])
  const [recommendedCombinations, setRecommendedCombinations] = useState<RecommendedCombination[]>([])
  const [loading, setLoading] = useState(false)
  const [includePartiallyCovered, setIncludePartiallyCovered] = useState(false)
  const [includeFlexibleStaff, setIncludeFlexibleStaff] = useState(true)
  const [includeOnlyRecommended, setIncludeOnlyRecommended] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])

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

  const fetchAbsences = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/sub-finder/absences?include_partially_covered=${includePartiallyCovered}`
      )
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to fetch absences')
      }
      const data = await response.json()
      setAbsences(data)
    } catch (error) {
      console.error('Error fetching absences:', error)
      setAbsences([])
    } finally {
      setLoading(false)
    }
  }, [includePartiallyCovered])

  const handleFindSubs = useCallback(
    async (absence: Absence) => {
      setSelectedAbsence(absence)
      setLoading(true)
      try {
        const response = await fetch('/api/sub-finder/find-subs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            absence_id: absence.id,
            include_flexible_staff: includeFlexibleStaff,
          }),
        })
        if (!response.ok) throw new Error('Failed to find subs')
        const data = await response.json()
        const subs = Array.isArray(data) ? (data as SubCandidate[]) : ((data.subs || []) as SubCandidate[])
        const combinations = !Array.isArray(data)
          ? data.recommended_combinations || (data.recommended_combination ? [data.recommended_combination] : [])
          : []
        setRecommendedCombinations(combinations)
        applySubResults(subs)
      } catch (error) {
        console.error('Error finding subs:', error)
      } finally {
        setLoading(false)
      }
    },
    [applySubResults, includeFlexibleStaff]
  )

  const handleFindManualSubs = useCallback(
    async ({ teacherId, startDate, endDate, shifts }: ManualFindInput) => {
      if (!teacherId || !startDate) return
      setLoading(true)
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
      } finally {
        setLoading(false)
      }
    },
    [applySubResults, getDisplayName, teachers]
  )

  useEffect(() => {
    if (mode === 'existing') {
      fetchAbsences()
    }
  }, [mode, includePartiallyCovered, fetchAbsences])

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
