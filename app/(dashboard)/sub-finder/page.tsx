'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronLeft, ChevronUp, RefreshCw, Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import AbsenceList from '@/components/sub-finder/AbsenceList'
import RecommendedSubsList from '@/components/sub-finder/RecommendedSubsList'
import type { RecommendedSub } from '@/components/sub-finder/ContactSubPanel'
import RecommendedCombination from '@/components/sub-finder/RecommendedCombination'
import ContactSubPanel from '@/components/sub-finder/ContactSubPanel'
import {
  useSubFinderData,
  type Mode,
  type Absence,
  type SubCandidate,
} from '@/components/sub-finder/hooks/useSubFinderData'
import ShiftSelectionTable from '@/components/time-off/ShiftSelectionTable'
import DatePickerInput from '@/components/ui/date-picker-input'
import { formatAbsenceDateRange, formatShortDate } from '@/lib/utils/date-format'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePanelManager } from '@/lib/contexts/PanelManagerContext'
import { saveSubFinderState, loadSubFinderState } from '@/lib/utils/sub-finder-state'
import { findTopCombinations } from '@/lib/utils/sub-combination'
import CoverageSummary from '@/components/sub-finder/CoverageSummary'
import ShiftStatusCard from '@/components/sub-finder/ShiftStatusCard'
import { useSubFinderShifts } from '@/components/sub-finder/hooks/useSubFinderShifts'
import type { SubFinderShift } from '@/lib/sub-finder/types'

export default function SubFinderPage() {
  const ENABLE_SHIFT_FOCUS_MODE = true
  const ENABLE_COLLAPSE_RECOMMENDED_ON_SHIFT = true
  const SHOW_MIDDLE_COLUMN_DEBUG_BORDERS = false
  const SHOW_RIGHT_PANEL_DEBUG_BORDERS = false
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedAbsenceId = searchParams.get('absence_id')
  const requestedTeacherId = searchParams.get('teacher_id')
  const [mode, setMode] = useState<Mode>('existing')
  const [includePastShifts, setIncludePastShifts] = useState(false)
  const [shiftFilters, setShiftFilters] = useState<string[]>(['all'])
  const [mobileView, setMobileView] = useState<'absences' | 'shifts' | 'assign'>('absences')
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(false)
  const subRecommendationParams = useMemo(() => ({ includePastShifts }), [includePastShifts])
  const {
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
  } = useSubFinderData({
    requestedAbsenceId,
    skipInitialFetch: true, // Skip initial fetch to allow state restoration first
    subRecommendationParams,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [teacherSearchInput, setTeacherSearchInput] = useState('') // Separate state for dropdown input
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]) // Array of selected teacher IDs
  const [subSearch, setSubSearch] = useState('')
  const [isSubSearchOpen, setIsSubSearchOpen] = useState(false)
  const teacherSearchRef = useRef<HTMLInputElement | null>(null)
  const [selectedSub, setSelectedSub] = useState<SubCandidate | null>(null)
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<SubFinderShift | null>(null)
  const [isMiddleShiftListExpanded, setIsMiddleShiftListExpanded] = useState(false)
  const [showRecommendedWhenShiftSelected, setShowRecommendedWhenShiftSelected] = useState(false)
  const [removeDialogShift, setRemoveDialogShift] = useState<SubFinderShift | null>(null)
  const [removingScope, setRemovingScope] = useState<'single' | 'all_for_absence' | null>(null)
  const [isAllSubsOpen, setIsAllSubsOpen] = useState(false)
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([])
  const [rightPanelActiveFilter, setRightPanelActiveFilter] = useState<string | null>('available')
  const [isTeacherSearchOpen, setIsTeacherSearchOpen] = useState(false)
  const { setActivePanel, previousPanel, restorePreviousPanel, registerPanelCloseHandler } =
    usePanelManager()
  const savedSubRef = useRef<SubCandidate | null>(null)
  const savedAbsenceRef = useRef<Absence | null>(null)
  const selectedAbsenceIdRef = useRef<string | null>(null) // Track selected absence ID to prevent loss during restoration
  // Cache contact data: key = `${subId}-${absenceId}`
  type ContactDataCacheEntry = {
    id: string
    is_contacted: boolean
    contacted_at: string | null
    response_status: 'none' | 'pending' | 'confirmed' | 'declined_all'
    notes: string | null
    shift_overrides?: Array<{
      coverage_request_shift_id?: string | null
      selected: boolean
      override_availability: boolean
      shift?: {
        date: string
        time_slot?: {
          code?: string | null
        } | null
      } | null
    }>
    coverage_request_id?: string
    shift_map?: Record<string, string>
    selected_shift_keys?: string[]
    override_shift_keys?: string[]
  }
  const [contactDataCache, setContactDataCache] = useState<Map<string, ContactDataCacheEntry>>(
    new Map()
  )
  const [highlightedSubId, setHighlightedSubId] = useState<string | null>(null)
  const [manualTeacherId, setManualTeacherId] = useState<string>('')
  const [manualStartDate, setManualStartDate] = useState<string>('')
  const [manualEndDate, setManualEndDate] = useState<string>('')
  const [manualSelectedShifts, setManualSelectedShifts] = useState<
    Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
  >([])
  const [manualTeacherSearch, setManualTeacherSearch] = useState('')
  const [isManualTeacherSearchOpen, setIsManualTeacherSearchOpen] = useState(false)
  const subSearchRef = useRef<HTMLDivElement | null>(null)
  const rightPanelRef = useRef<HTMLDivElement | null>(null)
  const manualEndDateRef = useRef<HTMLButtonElement | null>(null)
  const [endDateCorrected, setEndDateCorrected] = useState(false)
  const correctionTimeoutRef = useRef<number | null>(null)
  const isFlexibleStaffChangeUserInitiatedRef = useRef(false)

  useEffect(() => {
    if (!selectedShift) {
      setShowRecommendedWhenShiftSelected(false)
    }
  }, [selectedShift])

  useEffect(() => {
    setIsMiddleShiftListExpanded(false)
  }, [selectedAbsence?.id])
  const isRestoringStateRef = useRef(false) // Track if we're restoring state to avoid saving during restoration
  const hasRestoredStateRef = useRef(false) // Track if we've completed initial state restoration
  const displayRecommendedCombinations = useMemo(() => {
    if (recommendedCombinations.length > 0) {
      return recommendedCombinations
    }
    if (recommendedSubs.length > 0) {
      return findTopCombinations(recommendedSubs, 5)
    }
    return []
  }, [recommendedCombinations, recommendedSubs])

  const renderRecommendedPlaceholder = () => (
    <div className="mt-2 space-y-3">
      <div className="h-6 w-44 rounded bg-slate-200/80 animate-pulse" />
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 animate-pulse">
        <div className="h-6 w-1/3 rounded bg-slate-200" />
        <div className="h-5 w-1/2 rounded bg-slate-200" />
        <div className="h-16 rounded bg-slate-200" />
      </div>
    </div>
  )

  const runManualFinder = useCallback(async () => {
    if (!manualTeacherId || !manualStartDate || manualSelectedShifts.length === 0) return
    setHighlightedSubId(null)
    await handleFindManualSubs({
      teacherId: manualTeacherId,
      startDate: manualStartDate,
      endDate: manualEndDate || manualStartDate,
      shifts: manualSelectedShifts,
    })
  }, [manualTeacherId, manualStartDate, manualEndDate, manualSelectedShifts, handleFindManualSubs])
  const runFinderForAbsence = useCallback(
    async (absence: Absence) => {
      await handleFindSubs(absence)
    },
    [handleFindSubs]
  )
  const runFinderForAbsenceAndCollapse = useCallback(
    async (absence: Absence) => {
      await handleFindSubs(absence)
      setIsLeftRailCollapsed(true)
      setMobileView('shifts')
    },
    [handleFindSubs]
  )
  const runManualFinderAndCollapse = useCallback(async () => {
    await runManualFinder()
    setIsLeftRailCollapsed(true)
    setMobileView('shifts')
  }, [runManualFinder])
  const {
    shiftDetails,
    visibleShiftDetails,
    summary: shiftSummary,
    pastShiftCount,
    upcomingShiftCount,
  } = useSubFinderShifts(selectedAbsence, includePastShifts)
  const selectedClassrooms = useMemo(() => {
    if (!selectedAbsence) return []
    if (
      Array.isArray(
        (
          selectedAbsence as {
            classrooms?: Array<{ id: string; name: string; color: string | null }>
          }
        ).classrooms
      )
    ) {
      return (
        selectedAbsence as { classrooms: Array<{ id: string; name: string; color: string | null }> }
      ).classrooms
    }
    return Array.from(
      new Set(
        shiftDetails
          .map(shift => shift.classroom_name)
          .filter((name): name is string => Boolean(name))
      )
    ).map(name => ({ id: name, name, color: null }))
  }, [selectedAbsence, shiftDetails])
  const visibleShiftSummary = shiftSummary ?? selectedAbsence?.shifts ?? null
  const sortedVisibleShifts = useMemo(() => {
    if (!visibleShiftSummary) return visibleShiftDetails
    return visibleShiftSummary.shift_details_sorted ?? visibleShiftDetails
  }, [visibleShiftDetails, visibleShiftSummary])
  const contactedAvailableSubCountByShift = useMemo(() => {
    const countMap = new Map<string, number>()
    allSubs.forEach(sub => {
      const isContactedForAbsence =
        sub.is_contacted === true ||
        sub.response_status === 'pending' ||
        sub.response_status === 'confirmed' ||
        sub.response_status === 'declined_all'
      if (!isContactedForAbsence) return
      ;(sub.can_cover || []).forEach(shift => {
        const key = `${shift.date}|${shift.time_slot_code}`
        countMap.set(key, (countMap.get(key) || 0) + 1)
      })
    })
    return countMap
  }, [allSubs])
  const responseCountsByShift = useMemo(() => {
    const countsByShift = new Map<
      string,
      {
        available: number
        pending: number
        declined: number
        confirmed: number
        noResponse: number
      }
    >()
    allSubs.forEach(sub => {
      ;(sub.can_cover || []).forEach(shift => {
        const key = `${shift.date}|${shift.time_slot_code}`
        const entry = countsByShift.get(key) || {
          available: 0,
          pending: 0,
          declined: 0,
          confirmed: 0,
          noResponse: 0,
        }
        entry.available += 1
        if (sub.response_status === 'pending') {
          entry.pending += 1
        } else if (sub.response_status === 'declined_all') {
          entry.declined += 1
        } else if (sub.response_status === 'confirmed') {
          entry.confirmed += 1
        } else {
          entry.noResponse += 1
        }
        countsByShift.set(key, entry)
      })
    })
    return countsByShift
  }, [allSubs])
  const responseSummaryByShift = useMemo(() => {
    const summaryMap = new Map<string, string>()
    responseCountsByShift.forEach((counts, key) => {
      const parts: string[] = []
      if (counts.pending > 0) {
        parts.push(`${counts.pending} Sub${counts.pending === 1 ? '' : 's'} pending`)
      }
      if (counts.declined > 0) {
        parts.push(`${counts.declined} Sub${counts.declined === 1 ? '' : 's'} declined`)
      }
      if (counts.confirmed > 0) {
        parts.push(`${counts.confirmed} Sub${counts.confirmed === 1 ? '' : 's'} confirmed`)
      }
      summaryMap.set(key, parts.length > 0 ? parts.join(', ') : 'No response')
    })
    return summaryMap
  }, [responseCountsByShift])
  const shiftFilterCounts = useMemo(() => {
    const counts = {
      all: sortedVisibleShifts.length,
      needs_coverage: 0,
      not_contacted: 0,
      declined: 0,
      pending: 0,
      covered: 0,
    }
    sortedVisibleShifts.forEach(shift => {
      if (shift.status === 'fully_covered') {
        counts.covered += 1
      } else {
        counts.needs_coverage += 1
      }
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      const contactedCount = contactedAvailableSubCountByShift.get(shiftKey) || 0
      const responseCounts = responseCountsByShift.get(shiftKey)
      if (contactedCount === 0) {
        counts.not_contacted += 1
      }
      if ((responseCounts?.declined || 0) > 0) {
        counts.declined += 1
      }
      if ((responseCounts?.pending || 0) > 0) {
        counts.pending += 1
      }
    })
    return counts
  }, [contactedAvailableSubCountByShift, responseCountsByShift, sortedVisibleShifts])

  const rightPanelSubs = useMemo(() => {
    const baseSubs =
      selectedSubIds.length > 0 ? allSubs.filter(sub => selectedSubIds.includes(sub.id)) : allSubs

    if (!ENABLE_SHIFT_FOCUS_MODE || !selectedShift) {
      return baseSubs
    }

    const selectedShiftKey = `${selectedShift.date}|${selectedShift.time_slot_code}`
    return baseSubs.filter(sub => {
      const hasMatchingCanCover = (sub.can_cover || []).some(
        shift => `${shift.date}|${shift.time_slot_code}` === selectedShiftKey
      )
      const hasMatchingAssignedShift = (sub.assigned_shifts || []).some(
        shift => `${shift.date}|${shift.time_slot_code}` === selectedShiftKey
      )
      return hasMatchingCanCover || hasMatchingAssignedShift
    })
  }, [ENABLE_SHIFT_FOCUS_MODE, allSubs, selectedShift, selectedSubIds])
  const selectedShiftMatchCount = useMemo(() => {
    if (!selectedShift) return 0
    const selectedShiftKey = `${selectedShift.date}|${selectedShift.time_slot_code}`
    return allSubs.filter(sub =>
      (sub.can_cover || []).some(
        shift => `${shift.date}|${shift.time_slot_code}` === selectedShiftKey
      )
    ).length
  }, [allSubs, selectedShift])

  const selectedSubChips = useMemo(() => {
    if (selectedSubIds.length === 0) return []
    return selectedSubIds
      .map(id => {
        const sub = allSubs.find(item => item.id === id)
        return sub ? { id, name: getDisplayName(sub) } : { id, name: 'Unknown' }
      })
      .filter(item => item.name)
  }, [allSubs, getDisplayName, selectedSubIds])
  const shiftFilterOptions = useMemo(
    () => [
      { key: 'all', label: 'All', count: shiftFilterCounts.all },
      { key: 'needs_coverage', label: 'Needs Coverage', count: shiftFilterCounts.needs_coverage },
      { key: 'not_contacted', label: 'Not contacted', count: shiftFilterCounts.not_contacted },
      { key: 'declined', label: 'Declined', count: shiftFilterCounts.declined },
      { key: 'pending', label: 'Pending', count: shiftFilterCounts.pending },
      { key: 'covered', label: 'Covered', count: shiftFilterCounts.covered },
    ],
    [shiftFilterCounts]
  )
  const primaryShiftFilters = useMemo(
    () =>
      shiftFilterOptions.filter(
        option =>
          option.key === 'all' || option.key === 'needs_coverage' || option.key === 'not_contacted'
      ),
    [shiftFilterOptions]
  )
  const moreShiftFilters = useMemo(
    () =>
      shiftFilterOptions.filter(option => ['declined', 'pending', 'covered'].includes(option.key)),
    [shiftFilterOptions]
  )
  const hasActiveMoreShiftFilter = useMemo(
    () => moreShiftFilters.some(option => shiftFilters.includes(option.key)),
    [moreShiftFilters, shiftFilters]
  )
  const toggleShiftFilter = useCallback((key: string) => {
    setShiftFilters([key])
  }, [])
  const filteredShiftDetails = useMemo(() => {
    const activeFilter = shiftFilters[0] || 'all'
    if (activeFilter === 'all') return sortedVisibleShifts
    return sortedVisibleShifts.filter(shift => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      const contactedCount = contactedAvailableSubCountByShift.get(shiftKey) || 0
      const responseCounts = responseCountsByShift.get(shiftKey)
      const matches: Array<[string, boolean]> = [
        ['needs_coverage', shift.status !== 'fully_covered'],
        ['covered', shift.status === 'fully_covered'],
        ['not_contacted', contactedCount === 0],
        ['declined', (responseCounts?.declined || 0) > 0],
        ['pending', (responseCounts?.pending || 0) > 0],
      ]
      return matches.some(([key, isMatch]) => key === activeFilter && isMatch)
    })
  }, [contactedAvailableSubCountByShift, responseCountsByShift, shiftFilters, sortedVisibleShifts])
  const coverageSummaryLine = useMemo(() => {
    if (!visibleShiftSummary) return null
    const remaining =
      (visibleShiftSummary.uncovered ?? 0) + (visibleShiftSummary.partially_covered ?? 0)
    const total = visibleShiftSummary.total ?? 0
    return `${remaining} of ${total} upcoming shifts need coverage`
  }, [visibleShiftSummary])
  const absenceForUI = useMemo(() => {
    if (!selectedAbsence) return null
    if (!visibleShiftSummary) return selectedAbsence
    return {
      ...selectedAbsence,
      shifts: {
        ...selectedAbsence.shifts,
        total: visibleShiftSummary.total,
        uncovered: visibleShiftSummary.uncovered,
        partially_covered: visibleShiftSummary.partially_covered,
        fully_covered: visibleShiftSummary.fully_covered,
        shift_details: visibleShiftDetails,
        shift_details_sorted: visibleShiftSummary.shift_details_sorted,
        coverage_segments: visibleShiftSummary.coverage_segments,
      },
    }
  }, [selectedAbsence, visibleShiftDetails, visibleShiftSummary])
  const showPastShiftsBanner = Boolean(selectedAbsence && pastShiftCount > 0)
  const subCoverageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    shiftDetails.forEach(shift => {
      if (!shift.sub_id) return
      counts.set(shift.sub_id, (counts.get(shift.sub_id) || 0) + 1)
    })
    return counts
  }, [shiftDetails])
  const removeDialogSubName = removeDialogShift?.sub_name || 'this sub'
  const removeDialogTeacherName = selectedAbsence?.teacher_name || 'this teacher'
  const removeDialogHasMultiple =
    Boolean(removeDialogShift?.sub_id) &&
    (subCoverageCounts.get(removeDialogShift?.sub_id || '') || 0) > 1
  const isRightPanelOpen = Boolean(selectedSub || selectedShift || isAllSubsOpen)
  const middleColumnContentStyle = isRightPanelOpen
    ? {
        maxWidth: '640px',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: '24px',
        paddingRight: '24px',
        boxSizing: 'border-box' as const,
      }
    : {
        maxWidth: '840px',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: '16px',
        paddingRight: '16px',
        boxSizing: 'border-box' as const,
      }
  const sortedSubs = useMemo(() => {
    return [...allSubs].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
  }, [allSubs, getDisplayName])
  const filteredSubsForSearch = useMemo(() => {
    const query = subSearch.trim().toLowerCase()
    if (!query) return sortedSubs
    return sortedSubs.filter(sub => {
      return getDisplayName(sub, '').toLowerCase().includes(query)
    })
  }, [sortedSubs, subSearch, getDisplayName])
  const filteredManualTeachers = useMemo(() => {
    const query = manualTeacherSearch.trim().toLowerCase()
    if (!query) return teachers
    return teachers.filter(teacher => {
      return getDisplayName(teacher, '').toLowerCase().includes(query)
    })
  }, [teachers, manualTeacherSearch, getDisplayName])
  // Get all teacher names from the teachers array (not just those with absences)
  const teacherNames = useMemo(() => {
    return teachers.map(teacher => getDisplayName(teacher)).sort((a, b) => a.localeCompare(b))
  }, [teachers, getDisplayName])

  useEffect(() => {
    if (!isSubSearchOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (subSearchRef.current && !subSearchRef.current.contains(event.target as Node)) {
        setIsSubSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSubSearchOpen])

  const setCorrectionNotice = () => {
    if (correctionTimeoutRef.current) {
      window.clearTimeout(correctionTimeoutRef.current)
    }
    setEndDateCorrected(true)
    correctionTimeoutRef.current = window.setTimeout(() => {
      setEndDateCorrected(false)
      correctionTimeoutRef.current = null
    }, 5000)
  }

  const handleRerunFinder = async () => {
    if (!selectedAbsence) return
    if (mode === 'manual') {
      await runManualFinder()
      return
    }
    await runFinderForAbsence(selectedAbsence)
  }

  const lastIncludePastShiftsRef = useRef(includePastShifts)
  useEffect(() => {
    if (lastIncludePastShiftsRef.current === includePastShifts) return
    lastIncludePastShiftsRef.current = includePastShifts
    if (mode === 'existing' && selectedAbsence) {
      runFinderForAbsence(selectedAbsence).catch(error => {
        console.error('Failed to refresh subs after toggling past shifts:', error)
      })
    }
  }, [includePastShifts, mode, selectedAbsence, runFinderForAbsence])

  // Helper to create cache key
  const getCacheKey = (subId: string, absenceId: string) => `${subId}-${absenceId}`

  // Fetch contact data for a sub/absence combination
  const fetchContactDataForSub = async (sub: SubCandidate, absence: Absence) => {
    if (absence.id.startsWith('manual-')) {
      return null
    }
    const cacheKey = getCacheKey(sub.id, absence.id)

    // Check cache first
    if (contactDataCache.has(cacheKey)) {
      return contactDataCache.get(cacheKey)
    }

    try {
      // Get coverage_request_id first
      const coverageResponse = await fetch(`/api/sub-finder/coverage-request/${absence.id}`)
      if (!coverageResponse.ok) {
        const errorBody = await coverageResponse.text().catch(() => '')
        console.error(
          `Failed to fetch coverage request: status=${coverageResponse.status} statusText=${coverageResponse.statusText} url=${coverageResponse.url} body=${errorBody.slice(0, 200)}`
        )
        return null
      }

      const coverageData = await coverageResponse.json()

      // Get contact data
      const contactResponse = await fetch(
        `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageData.coverage_request_id}&sub_id=${sub.id}`
      )

      if (contactResponse.ok) {
        const contactData = await contactResponse.json()
        const data = {
          ...contactData,
          coverage_request_id: coverageData.coverage_request_id,
          shift_map: coverageData.shift_map || {},
        }

        // Cache it
        setContactDataCache(prev => new Map(prev).set(cacheKey, data))
        return data
      }
    } catch (error) {
      console.error('Error fetching contact data:', error)
    }

    return null
  }

  // Invalidate cache for a specific sub/absence combination
  const handleContactSub = async (sub: SubCandidate) => {
    setSelectedSub(sub)
    setIsContactPanelOpen(true)
    setSelectedShift(null)
    setMobileView('assign')

    // Prefetch contact data in background if we have an absence
    if (selectedAbsence) {
      fetchContactDataForSub(sub, selectedAbsence).catch(error => {
        console.error('Error prefetching contact data:', error)
      })
    }
  }

  const handleSaveSubNote = async (sub: SubCandidate, nextNote: string | null) => {
    if (!selectedAbsence || selectedAbsence.id.startsWith('manual-')) {
      toast('Notes can only be saved for existing absences.')
      return
    }
    const contactData = await fetchContactDataForSub(sub, selectedAbsence)
    if (!contactData?.id) {
      toast('Unable to load contact record for this sub.')
      return
    }
    try {
      const response = await fetch('/api/sub-finder/substitute-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contactData.id, notes: nextNote }),
      })
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        console.error('Failed to update sub note', response.status, errorBody)
        toast('Failed to save note.')
        return
      }
      const updated = allSubs.map(item =>
        item.id === sub.id ? { ...item, notes: nextNote } : item
      )
      applySubResults(updated)
      const cacheKey = getCacheKey(sub.id, selectedAbsence.id)
      setContactDataCache(prev => {
        const next = new Map(prev)
        const existing = next.get(cacheKey)
        if (existing) {
          next.set(cacheKey, { ...existing, notes: nextNote })
        }
        return next
      })
      if (selectedSub?.id === sub.id) {
        setSelectedSub({ ...selectedSub, notes: nextNote })
      }
      toast('Note saved.')
    } catch (error) {
      console.error('Failed to update sub note', error)
      toast('Failed to save note.')
    }
  }

  const scrollToSubCard = (subId: string) => {
    const element = document.getElementById(`sub-card-${subId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedSubId(subId)
      setTimeout(() => {
        setHighlightedSubId(null)
      }, 2000)
    }
  }

  const handleSelectShift = useCallback((shift: SubFinderShift) => {
    setSelectedShift(shift)
    setSelectedSub(null)
    setIsContactPanelOpen(false)
    setIsAllSubsOpen(true)
    setMobileView('assign')
  }, [])

  const handleOpenRemoveDialog = useCallback((shift: SubFinderShift) => {
    setRemoveDialogShift(shift)
  }, [])

  const handleCloseRemoveDialog = useCallback(() => {
    if (removingScope) return
    setRemoveDialogShift(null)
  }, [removingScope])

  const handleRemoveSubAssignment = useCallback(
    async (scope: 'single' | 'all_for_absence') => {
      if (!selectedAbsence || !removeDialogShift?.sub_id) return
      if (scope === 'single' && !removeDialogShift.assignment_id) {
        toast.error('Unable to remove this assignment. Try refreshing the page.')
        return
      }

      try {
        setRemovingScope(scope)
        const response = await fetch('/api/sub-finder/unassign-shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            absence_id: selectedAbsence.id,
            sub_id: removeDialogShift.sub_id,
            scope,
            assignment_id: scope === 'single' ? removeDialogShift.assignment_id : undefined,
          }),
        })

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(() => ({ error: 'Failed to remove sub assignment.' }))
          throw new Error(errorBody.error || 'Failed to remove sub assignment.')
        }
        const result = await response.json().catch(() => ({ removed_count: 0 }))

        const removedSubName = removeDialogShift.sub_name || 'the sub'
        const removedCount = result.removed_count || 0
        const remainingOnShift = result.remaining_active_on_target_shift
        if (scope === 'single' && typeof remainingOnShift === 'number' && remainingOnShift > 0) {
          toast.success(
            `Removed ${removedSubName} from this assignment (${removedCount}). ${remainingOnShift} active assignment${remainingOnShift === 1 ? '' : 's'} still remain on this shift.`
          )
        } else {
          toast.success(
            scope === 'single'
              ? `Removed ${removedSubName} from this shift (${removedCount} assignment${removedCount === 1 ? '' : 's'}).`
              : `Removed ${removedSubName} from all shifts for this request (${removedCount} assignment${removedCount === 1 ? '' : 's'}).`
          )
        }

        setContactDataCache(prev => {
          const next = new Map(prev)
          for (const [key] of next) {
            if (key.endsWith(`-${selectedAbsence.id}`)) {
              next.delete(key)
            }
          }
          return next
        })

        const refreshedAbsences = await fetchAbsences()
        const refreshedSelectedAbsence = refreshedAbsences.find(
          absence => absence.id === selectedAbsence.id
        )
        if (refreshedSelectedAbsence) {
          setSelectedAbsence(refreshedSelectedAbsence)
          await runFinderForAbsence(refreshedSelectedAbsence)
        } else {
          await runFinderForAbsence(selectedAbsence)
        }
        setRemoveDialogShift(null)
      } catch (error) {
        console.error('Failed to remove sub assignment(s):', error)
        toast.error(error instanceof Error ? error.message : 'Failed to remove sub assignment.')
      } finally {
        setRemovingScope(null)
      }
    },
    [fetchAbsences, removeDialogShift, runFinderForAbsence, selectedAbsence]
  )

  const openAllSubsPanel = useCallback(() => {
    setIsAllSubsOpen(true)
    setSelectedShift(null)
    setSelectedSub(null)
    setMobileView('assign')
  }, [])

  const closeRightPanel = useCallback(() => {
    setIsContactPanelOpen(false)
    setSelectedSub(null)
    setSelectedShift(null)
    setIsAllSubsOpen(false)
  }, [])

  const closeContactPanel = useCallback(() => {
    setIsContactPanelOpen(false)
    setSelectedSub(null)
  }, [])

  useEffect(() => {
    if (!isRightPanelOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isContactPanelOpen) {
          closeContactPanel()
        } else {
          closeRightPanel()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeRightPanel, closeContactPanel, isContactPanelOpen, isRightPanelOpen])

  useEffect(() => {
    if (!isRightPanelOpen || isContactPanelOpen || removeDialogShift) return
    if (typeof window !== 'undefined' && window.innerWidth < 768) return

    const handleClickOutsideRightPanel = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      const targetElement = target as HTMLElement
      if (targetElement.closest('[data-radix-popper-content-wrapper]')) return
      if (rightPanelRef.current?.contains(target)) return
      closeRightPanel()
    }

    document.addEventListener('mousedown', handleClickOutsideRightPanel)
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideRightPanel)
    }
  }, [closeRightPanel, isRightPanelOpen, isContactPanelOpen, removeDialogShift])

  // Handle panel restoration when Add Time Off closes
  useEffect(() => {
    if (
      previousPanel?.type === 'contact-sub' &&
      !isContactPanelOpen &&
      savedSubRef.current &&
      savedAbsenceRef.current
    ) {
      // Restore the panel
      setSelectedSub(savedSubRef.current)
      setSelectedAbsence(savedAbsenceRef.current)
      setIsContactPanelOpen(true)
      setActivePanel('contact-sub')
      restorePreviousPanel()
    }
  }, [previousPanel, isContactPanelOpen, setActivePanel, restorePreviousPanel, setSelectedAbsence])

  // Register panel with PanelManager when it opens
  useEffect(() => {
    if (isContactPanelOpen && selectedSub && selectedAbsence) {
      setActivePanel('contact-sub', () => {
        // Restore callback - save current state and reopen
        savedSubRef.current = selectedSub
        savedAbsenceRef.current = selectedAbsence
        setSelectedSub(selectedSub)
        setSelectedAbsence(selectedAbsence)
        setIsContactPanelOpen(true)
      })

      // Register close request handler
      const unregister = registerPanelCloseHandler('contact-sub', () => {
        // Save state before closing
        savedSubRef.current = selectedSub
        savedAbsenceRef.current = selectedAbsence
        setIsContactPanelOpen(false)
      })

      return unregister
    } else if (!isContactPanelOpen) {
      setActivePanel(null)
    }
  }, [
    isContactPanelOpen,
    selectedSub,
    selectedAbsence,
    setActivePanel,
    registerPanelCloseHandler,
    setSelectedAbsence,
  ])

  // Wrapper for setIncludeFlexibleStaff removed (no longer used)

  // Auto-rerun Finder when includeFlexibleStaff changes (user-initiated only)
  useEffect(() => {
    if (isFlexibleStaffChangeUserInitiatedRef.current && selectedAbsence && mode === 'existing') {
      isFlexibleStaffChangeUserInitiatedRef.current = false // Reset flag
      runFinderForAbsence(selectedAbsence)
    } else if (isFlexibleStaffChangeUserInitiatedRef.current) {
      // Reset flag even if we don't rerun (e.g., no selected absence)
      isFlexibleStaffChangeUserInitiatedRef.current = false
    }
  }, [includeFlexibleStaff, selectedAbsence, mode, runFinderForAbsence])

  // Handler for combination contact button
  const handleCombinationContact = (subId: string) => {
    const sub = allSubs.find(s => s.id === subId)
    if (sub) {
      handleContactSub(sub)
    }
  }

  // Handle shift click to scroll to sub card
  const handleShiftClick = (shift: {
    id: string
    date: string
    day_name: string
    time_slot_code: string
    status: 'uncovered' | 'partially_covered' | 'fully_covered'
    sub_name?: string | null
    is_partial?: boolean
  }) => {
    if (!shift.sub_name) return

    // Find the sub in recommendedSubs by matching assigned shifts
    const sub = recommendedSubs.find(s => {
      return s.assigned_shifts?.some(
        as => as.date === shift.date && as.time_slot_code === shift.time_slot_code
      )
    })

    if (sub) {
      // Scroll to sub card
      setTimeout(() => {
        const element = document.getElementById(`sub-card-${sub.id}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })

          // Highlight the card
          setHighlightedSubId(sub.id)
          setTimeout(() => {
            setHighlightedSubId(null)
          }, 2000)
        }
      }, 100) // Small delay to ensure DOM is ready
    }
  }

  // Set selected teachers when teacher_id is provided from URL
  useEffect(() => {
    if (requestedTeacherId && !selectedTeacherIds.includes(requestedTeacherId)) {
      setSelectedTeacherIds([requestedTeacherId])
      // Clear teacher_id from URL after adding to selection
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('teacher_id')
      router.replace(`/sub-finder?${newSearchParams.toString()}`)
    }
  }, [requestedTeacherId, selectedTeacherIds, searchParams, router])

  // Filter absences based on selected teachers
  const filteredAbsences = useMemo(() => {
    let filtered = absences

    // If teachers are selected, filter by those teachers
    if (selectedTeacherIds.length > 0) {
      filtered = filtered.filter(absence => selectedTeacherIds.includes(absence.teacher_id))
    }
    // Otherwise, show all absences (no filtering)

    return filtered
  }, [absences, selectedTeacherIds])

  // Add teacher to selection
  const addTeacherToSelection = (teacherId: string) => {
    if (!selectedTeacherIds.includes(teacherId)) {
      setSelectedTeacherIds([...selectedTeacherIds, teacherId])
    }
    setTeacherSearchInput('')
    setIsTeacherSearchOpen(false)
    teacherSearchRef.current?.blur()
  }

  // Remove teacher from selection
  const removeTeacherFromSelection = (teacherId: string) => {
    setSelectedTeacherIds(selectedTeacherIds.filter(id => id !== teacherId))
  }

  // Auto-select first absence if exactly one absence matches selected teachers
  useEffect(() => {
    if (selectedTeacherIds.length > 0 && filteredAbsences.length === 1 && !selectedAbsence) {
      setSelectedAbsence(filteredAbsences[0])
    }
  }, [selectedTeacherIds, filteredAbsences, selectedAbsence, setSelectedAbsence])

  // Load saved state on mount (only if no URL params override)
  useEffect(() => {
    if (hasRestoredStateRef.current) return
    // Only restore if we don't have URL params that override
    if (requestedAbsenceId || requestedTeacherId) {
      hasRestoredStateRef.current = true // Mark as complete even if we skip restoration
      return // URL params take precedence
    }

    const savedState = loadSubFinderState()

    if (!savedState) {
      hasRestoredStateRef.current = true // Mark as complete if no saved state
      return
    }

    isRestoringStateRef.current = true

    // Restore mode
    if (savedState.mode) {
      setMode(savedState.mode)
    }

    // Restore selected teachers
    if (savedState.selectedTeacherIds && savedState.selectedTeacherIds.length > 0) {
      setSelectedTeacherIds(savedState.selectedTeacherIds)
    }

    // Restore manual coverage state
    if (savedState.mode === 'manual') {
      if (savedState.manualTeacherId) {
        setManualTeacherId(savedState.manualTeacherId)
      }
      if (savedState.manualStartDate) {
        setManualStartDate(savedState.manualStartDate)
      }
      if (savedState.manualEndDate) {
        setManualEndDate(savedState.manualEndDate)
      }
      if (savedState.manualSelectedShifts && savedState.manualSelectedShifts.length > 0) {
        setManualSelectedShifts(savedState.manualSelectedShifts)
      }
    }

    // Restore filter options
    if (typeof savedState.includePartiallyCovered === 'boolean') {
      setIncludePartiallyCovered(savedState.includePartiallyCovered)
    }
    if (typeof savedState.includeFlexibleStaff === 'boolean') {
      setIncludeFlexibleStaff(savedState.includeFlexibleStaff)
    }
    if (typeof savedState.includeOnlyRecommended === 'boolean') {
      setIncludeOnlyRecommended(savedState.includeOnlyRecommended)
    }
    if (typeof savedState.includePastShifts === 'boolean') {
      setIncludePastShifts(savedState.includePastShifts)
    }
    if (savedState.subSearch) {
      setSubSearch(savedState.subSearch)
    }

    hasRestoredStateRef.current = true
    // Reset flag after a short delay to allow other effects to run
    setTimeout(() => {
      isRestoringStateRef.current = false
      if (mode === 'existing') {
        fetchAbsences()
      }
    }, 500) // Give enough time for all restoration effects to complete
  }, [
    fetchAbsences,
    mode,
    requestedAbsenceId,
    requestedTeacherId,
    setIncludeFlexibleStaff,
    setIncludeOnlyRecommended,
    setIncludePartiallyCovered,
  ])

  // Restore selected absence after absences are loaded (for existing mode)
  useEffect(() => {
    if (requestedAbsenceId || mode !== 'existing') return // URL param takes precedence, or skip if manual mode
    if (absences.length === 0) return // Wait for absences to load

    const savedState = loadSubFinderState()
    // Use ref first (most recent), then saved state, then current selection
    const targetAbsenceId =
      selectedAbsenceIdRef.current || savedState?.selectedAbsenceId || selectedAbsence?.id

    if (!targetAbsenceId) {
      return // No saved absence to restore
    }

    // If we already have the correct absence selected, just update the ref and return
    if (selectedAbsence?.id === targetAbsenceId) {
      const absence = absences.find(a => a.id === targetAbsenceId)
      if (absence && absence !== selectedAbsence) {
        // Update to new object reference to keep in sync
        setSelectedAbsence(absence)
      }
      selectedAbsenceIdRef.current = targetAbsenceId
      return
    }

    // Check if it's a manual mode absence (starts with 'manual-')
    if (targetAbsenceId.startsWith('manual-')) return

    // Find the absence in the current absences list
    const absence = absences.find(a => a.id === targetAbsenceId)

    // If we have a selected absence, check if it still exists in the new list
    if (selectedAbsence) {
      const currentAbsenceStillExists = absences.find(a => a.id === selectedAbsence.id)
      if (currentAbsenceStillExists) {
        // Update to the new object reference to keep it in sync with React Query data
        if (currentAbsenceStillExists !== selectedAbsence) {
          setSelectedAbsence(currentAbsenceStillExists)
        }
        // Update ref to track the current selection
        selectedAbsenceIdRef.current = selectedAbsence.id
        return // Current selection is still valid
      }
      // Current selected absence no longer exists in the list - clear it
      // and try to restore from saved state below
    }

    // Restore from saved state if we found the absence
    if (absence) {
      isRestoringStateRef.current = true
      selectedAbsenceIdRef.current = absence.id // Update ref immediately
      setSelectedAbsence(absence)

      setTimeout(() => {
        runFinderForAbsence(absence).finally(() => {
          isRestoringStateRef.current = false
          hasRestoredStateRef.current = true
        })
      }, 100)
    } else if (selectedAbsence && !absences.find(a => a.id === selectedAbsence.id)) {
      // Selected absence no longer exists in the list - clear it
      selectedAbsenceIdRef.current = null
      setSelectedAbsence(null)
    }
  }, [
    absences,
    absences.length,
    requestedAbsenceId,
    mode,
    selectedAbsence,
    setSelectedAbsence,
    runFinderForAbsence,
    applySubResults,
    setRecommendedCombinations,
  ])

  // Update ref whenever selectedAbsence changes (to track it even during restoration)
  useEffect(() => {
    if (selectedAbsence?.id) {
      selectedAbsenceIdRef.current = selectedAbsence.id
    } else if (!selectedAbsence) {
      // Only clear ref if we're not in the middle of restoration
      if (!isRestoringStateRef.current) {
        selectedAbsenceIdRef.current = null
      }
    }
  }, [selectedAbsence])

  useEffect(() => {
    if (!selectedAbsence || mode !== 'existing') return
    if (selectedAbsence.id.startsWith('manual-')) return
    const match = absences.find(absence => absence.id === selectedAbsence.id)
    if (match && match !== selectedAbsence) {
      setSelectedAbsence(match)
    }
  }, [absences, mode, selectedAbsence, setSelectedAbsence])

  // Restore manual mode results after form data is restored
  useEffect(() => {
    if (
      mode !== 'manual' ||
      !manualTeacherId ||
      !manualStartDate ||
      manualSelectedShifts.length === 0
    )
      return
    if (selectedAbsence) return

    runManualFinder().catch(error => {
      console.error('[SubFinder] Failed to restore manual results:', error)
    })
  }, [
    mode,
    manualTeacherId,
    manualStartDate,
    manualEndDate,
    manualSelectedShifts,
    selectedAbsence,
    runManualFinder,
  ])

  // Save state whenever it changes (but not during restoration or before initial restoration)
  useEffect(() => {
    if (isRestoringStateRef.current || !hasRestoredStateRef.current) {
      return
    }
    // Use ref if selectedAbsence is null but we have a ref value (during brief restoration moments)
    const absenceIdToSave = selectedAbsence?.id || selectedAbsenceIdRef.current || null
    saveSubFinderState({
      mode,
      selectedTeacherIds,
      selectedAbsenceId: absenceIdToSave,
      manualTeacherId,
      manualStartDate,
      manualEndDate,
      manualSelectedShifts,
      includePartiallyCovered,
      includeFlexibleStaff,
      includeOnlyRecommended,
      includePastShifts,
      subSearch,
    })
  }, [
    mode,
    selectedTeacherIds,
    selectedAbsence?.id,
    manualTeacherId,
    manualStartDate,
    manualEndDate,
    manualSelectedShifts,
    includePartiallyCovered,
    includeFlexibleStaff,
    includeOnlyRecommended,
    includePastShifts,
    subSearch,
    absences.length,
  ])

  const renderLeftRail = (railCollapsed: boolean, allowCollapse: boolean) => {
    const railWidth = railCollapsed ? '3.5rem' : '26rem'
    return (
      <div
        className={cn(
          'relative flex-none border-r border-slate-200 bg-slate-100 shadow-[2px_0_6px_rgba(0,0,0,0.03)] flex flex-col overflow-y-auto transition-all h-full',
          railCollapsed ? 'w-14' : 'w-[26rem]'
        )}
        style={{ width: railWidth, minWidth: railWidth, maxWidth: railWidth }}
      >
        <div
          className={cn(
            'sticky top-6 z-10 border-b border-slate-200 bg-slate-100 flex flex-col',
            railCollapsed ? 'px-2 pt-6 pb-3 items-center' : 'px-6 pt-10 pb-4'
          )}
        >
          <div
            className={cn(
              'flex w-full items-center',
              railCollapsed ? 'justify-center' : 'justify-between'
            )}
          >
            {!railCollapsed ? (
              <>
                <h1 className="text-xl font-bold text-slate-900 pl-2">Sub Finder</h1>
                {allowCollapse && (
                  <button
                    type="button"
                    aria-label="Collapse left panel"
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900'
                    )}
                    onClick={() => setIsLeftRailCollapsed(true)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                aria-label="Expand absences panel"
                className="flex w-full flex-col items-center gap-1 py-3 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setIsLeftRailCollapsed(false)}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-400 bg-white">
                  <Search className="h-3.5 w-3.5" />
                </span>
                <span className="leading-tight text-[9px] font-medium text-slate-700">
                  Show
                  <br />
                  Absences
                </span>
              </button>
            )}
          </div>

          {!railCollapsed && (
            <>
              {/* Mode Toggle - Pill */}
              <div className="mt-4 mb-4 rounded-full border border-slate-200 bg-white/70 p-1">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode('existing')}
                    className={cn(
                      'flex-1 rounded-full text-xs font-semibold transition-all',
                      mode === 'existing'
                        ? '!bg-button-fill !text-button-fill-foreground shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    )}
                  >
                    Existing Absences
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode('manual')}
                    className={cn(
                      'flex-1 rounded-full text-xs font-semibold transition-all',
                      mode === 'manual'
                        ? '!bg-button-fill !text-button-fill-foreground shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    )}
                  >
                    Manual Coverage
                  </Button>
                </div>
              </div>

              {/* Search/Filter (for existing absences mode) */}
              {mode === 'existing' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <div className="flex-1">
                      <div className="rounded-md border border-slate-200 bg-white/80">
                        <div className="px-2 py-1">
                          <input
                            type="text"
                            placeholder="Search teachers..."
                            value={isTeacherSearchOpen ? teacherSearchInput : searchQuery}
                            ref={teacherSearchRef}
                            onChange={e => {
                              if (isTeacherSearchOpen) {
                                setTeacherSearchInput(e.target.value)
                              } else {
                                setSearchQuery(e.target.value)
                              }
                            }}
                            onFocus={() => {
                              setTeacherSearchInput('') // Clear dropdown input when opening
                              setIsTeacherSearchOpen(true)
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setIsTeacherSearchOpen(false)
                                setTeacherSearchInput('')
                              }, 150)
                            }}
                            className="w-full bg-transparent text-sm focus:outline-none"
                          />
                        </div>
                        {isTeacherSearchOpen && (
                          <div className="border-t border-slate-100 max-h-40 overflow-y-auto px-2 py-1">
                            {teacherNames
                              .filter(name => {
                                const query = teacherSearchInput.toLowerCase()
                                // If there's a query in the dropdown input, filter by it. Otherwise show all teachers
                                return !query || name.toLowerCase().includes(query)
                              })
                              .map(name => {
                                const teacher = teachers.find(t => getDisplayName(t) === name)
                                const teacherId = teacher?.id
                                const isSelected = Boolean(
                                  teacherId && selectedTeacherIds.includes(teacherId)
                                )
                                return (
                                  <button
                                    key={name}
                                    type="button"
                                    className={cn(
                                      'w-full rounded px-1.5 py-1 text-left text-sm text-slate-700 hover:bg-slate-100',
                                      isSelected && 'bg-slate-100 opacity-60'
                                    )}
                                    onClick={() => {
                                      if (teacherId && !isSelected) {
                                        addTeacherToSelection(teacherId)
                                      }
                                    }}
                                    disabled={isSelected}
                                  >
                                    {name}
                                  </button>
                                )
                              })}
                            {teacherNames.filter(name => {
                              const query = teacherSearchInput.toLowerCase()
                              return !query || name.toLowerCase().includes(query)
                            }).length === 0 && (
                              <div className="px-1.5 py-1 text-xs text-muted-foreground">
                                No matches
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Selected Teachers Pills */}
                  {selectedTeacherIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedTeacherIds.map(teacherId => {
                        const teacher = teachers.find(t => t.id === teacherId)
                        if (!teacher) return null
                        const teacherName = getDisplayName(teacher)
                        return (
                          <div
                            key={teacherId}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            <span>{teacherName}</span>
                            <button
                              type="button"
                              onClick={() => removeTeacherFromSelection(teacherId)}
                              className="hover:bg-slate-200 rounded-full p-0.5 -mr-1 ml-0.5"
                              aria-label={`Remove ${teacherName}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Manual Coverage Form (for manual mode) */}
              {mode === 'manual' && (
                <div className="mt-3 space-y-2">
                  <div>
                    <Label className="text-sm">Teacher</Label>
                    <div className="mt-1">
                      <div className="rounded-md border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 px-2 py-1">
                          <Input
                            placeholder="Search teachers..."
                            value={manualTeacherSearch}
                            onChange={event => setManualTeacherSearch(event.target.value)}
                            onFocus={() => setIsManualTeacherSearchOpen(true)}
                            onBlur={() => {
                              setTimeout(() => setIsManualTeacherSearchOpen(false), 150)
                            }}
                            className="h-8 border-0 bg-slate-50 text-sm focus-visible:ring-0"
                          />
                        </div>
                        {isManualTeacherSearchOpen && (
                          <div className="max-h-52 overflow-y-auto p-2">
                            {filteredManualTeachers.map(teacher => {
                              const name = getDisplayName(teacher)
                              return (
                                <button
                                  key={teacher.id}
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                                  onClick={() => {
                                    setManualTeacherId(teacher.id)
                                    setManualTeacherSearch(name)
                                    setIsManualTeacherSearchOpen(false)
                                  }}
                                >
                                  {name}
                                </button>
                              )
                            })}
                            {filteredManualTeachers.length === 0 && (
                              <div className="px-2 py-1 text-xs text-muted-foreground">
                                No matches
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Start Date</Label>
                    <div className="mt-1">
                      <DatePickerInput
                        value={manualStartDate}
                        onChange={value => {
                          setManualStartDate(value)
                          if (manualEndDate && value && manualEndDate < value) {
                            setManualEndDate(value)
                            setCorrectionNotice()
                          } else if (manualEndDate) {
                            setEndDateCorrected(false)
                          }
                          setTimeout(() => {
                            manualEndDateRef.current?.focus()
                            manualEndDateRef.current?.click()
                          }, 0)
                        }}
                        placeholder="Select start date"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">End Date</Label>
                    <div className="mt-1">
                      <DatePickerInput
                        ref={manualEndDateRef}
                        value={manualEndDate}
                        onChange={value => {
                          if (manualStartDate && value && value < manualStartDate) {
                            setManualEndDate(manualStartDate)
                            setCorrectionNotice()
                            return
                          }
                          setManualEndDate(value)
                          setEndDateCorrected(false)
                        }}
                        placeholder="Select end date"
                        allowClear
                        closeOnSelect
                      />
                    </div>
                    {endDateCorrected && (
                      <p className="text-xs text-amber-600 mt-1">
                        End date adjusted to match start date.
                      </p>
                    )}
                  </div>
                  <div className="pt-3 mt-2 border-t border-slate-200">
                    <ShiftSelectionTable
                      teacherId={manualTeacherId || null}
                      startDate={manualStartDate}
                      endDate={manualEndDate || manualStartDate}
                      selectedShifts={manualSelectedShifts}
                      onShiftsChange={shifts => {
                        setManualSelectedShifts(shifts)
                      }}
                      autoSelectScheduled
                      tableClassName="text-xs [&_th]:px-2 [&_td]:px-2"
                    />
                    {manualSelectedShifts.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">Select at least one shift.</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-slate-200 text-primary hover:bg-button-fill hover:text-button-fill-foreground focus:bg-button-fill focus:text-button-fill-foreground"
                    disabled={
                      !manualTeacherId || !manualStartDate || manualSelectedShifts.length === 0
                    }
                    onClick={runManualFinderAndCollapse}
                  >
                    Find Subs
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Absences List */}
        {!railCollapsed && mode === 'existing' && (
          <div className="flex-1 px-6 pb-4">
            <AbsenceList
              absences={filteredAbsences}
              selectedAbsence={selectedAbsence}
              onSelectAbsence={setSelectedAbsence}
              onFindSubs={runFinderForAbsenceAndCollapse}
              loading={loading}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem+1.5rem+4rem)] h-[calc(100vh-4rem+1.5rem+4rem)] overflow-hidden -mx-4 -mt-[calc(1.5rem+4rem)] -mb-6 relative flex-col md:flex-row md:-ml-8">
      <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
        {mobileView !== 'absences' && (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            onClick={() => {
              if (mobileView === 'assign') {
                closeRightPanel()
                setMobileView('shifts')
              } else {
                setMobileView('absences')
              }
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            {mobileView === 'assign' ? 'Shifts' : 'Absences'}
          </button>
        )}
        <div className="text-sm font-semibold text-slate-900">
          {mobileView === 'absences'
            ? 'Absences'
            : mobileView === 'assign'
              ? selectedSub
                ? 'Assign Sub'
                : 'All Subs'
              : 'Shifts'}
        </div>
      </div>

      {/* Mobile: single view at a time */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {mobileView === 'absences' && renderLeftRail(false, false)}
        {mobileView === 'shifts' && (
          <>
            <div className="px-4">
              {selectedAbsence && (
                <div className="py-4 flex flex-col gap-6 w-full">
                  {ENABLE_COLLAPSE_RECOMMENDED_ON_SHIFT &&
                  selectedShift &&
                  !showRecommendedWhenShiftSelected ? (
                    <button
                      type="button"
                      onClick={() => setShowRecommendedWhenShiftSelected(true)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-100 bg-amber-50/40 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50"
                    >
                      <span>Show recommended subs</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  ) : loading ? (
                    renderRecommendedPlaceholder()
                  ) : displayRecommendedCombinations.length > 0 ? (
                    <div className="mt-2">
                      <RecommendedCombination
                        combinations={displayRecommendedCombinations}
                        onContactSub={handleCombinationContact}
                        totalShifts={visibleShiftSummary?.total ?? selectedAbsence.shifts.total}
                        useRemainingLabel={
                          (visibleShiftSummary?.total ?? selectedAbsence.shifts.total) >
                          (visibleShiftSummary?.uncovered ?? selectedAbsence.shifts.uncovered)
                        }
                        allSubs={allSubs}
                        allShifts={visibleShiftDetails}
                        includePastShifts={includePastShifts}
                        onShowAllSubs={openAllSubsPanel}
                      />
                    </div>
                  ) : null}
                </div>
              )}
              {selectedAbsence && (
                <div className="py-4 flex flex-col gap-3 w-full">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2 md:flex-row md:items-center">
                      {shiftFilterOptions.map(option => {
                        const isActive = shiftFilters.includes(option.key)
                        return (
                          <button
                            type="button"
                            key={option.key}
                            onClick={() => toggleShiftFilter(option.key)}
                            className={cn(
                              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                              isActive
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            {option.label} ({option.count})
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {filteredShiftDetails.length > 0 ? (
                    filteredShiftDetails.map(shift => (
                      <ShiftStatusCard
                        key={shift.id}
                        shift={shift}
                        teacherName={selectedAbsence.teacher_name}
                        contactedAvailableSubCount={
                          contactedAvailableSubCountByShift.get(
                            `${shift.date}|${shift.time_slot_code}`
                          ) || 0
                        }
                        responseSummary={
                          responseSummaryByShift.get(`${shift.date}|${shift.time_slot_code}`) ||
                          'No response'
                        }
                        onSelectShift={handleSelectShift}
                        onChangeSub={handleSelectShift}
                        onRemoveSub={handleOpenRemoveDialog}
                      />
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                      No shifts to display.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {mobileView === 'assign' && (
          <div className="px-4 py-4">
            {selectedAbsence && selectedSub ? (
              <ContactSubPanel
                isOpen={isRightPanelOpen}
                onClose={closeRightPanel}
                sub={selectedSub as RecommendedSub}
                absence={selectedAbsence}
                variant="inline"
                initialContactData={
                  selectedSub && selectedAbsence
                    ? contactDataCache.get(getCacheKey(selectedSub.id, selectedAbsence.id))
                    : undefined
                }
                onAssignmentComplete={async () => {
                  if (selectedAbsence) {
                    setContactDataCache(prev => {
                      const next = new Map(prev)
                      for (const [key] of next) {
                        if (key.endsWith(`-${selectedAbsence.id}`)) {
                          next.delete(key)
                        }
                      }
                      return next
                    })
                  }
                  await fetchAbsences()
                  if (selectedAbsence) {
                    await runFinderForAbsence(selectedAbsence)
                  }
                }}
              />
            ) : selectedAbsence ? (
              <div className="rounded-lg border border-slate-200 bg-slate-100">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold text-slate-900">
                      Subs for {selectedAbsence.teacher_name}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span>
                        {formatAbsenceDateRange(
                          selectedAbsence.start_date,
                          selectedAbsence.end_date
                        )}
                      </span>
                      {selectedClassrooms.length > 0 ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {selectedClassrooms.map(classroom => (
                            <span
                              key={classroom.id || classroom.name}
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                              style={getClassroomPillStyle(classroom.color)}
                            >
                              {classroom.name}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Classroom unavailable</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeRightPanel}
                    aria-label="Close"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleRerunFinder}
                      disabled={loading}
                      size="sm"
                      variant="outline"
                      className="w-auto justify-center"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Rerun Finder
                    </Button>

                    <div className="flex-1 space-y-2">
                      <div
                        ref={subSearchRef}
                        className="mt-4 rounded-md border border-slate-200 bg-white"
                      >
                        <div className="p-1.5">
                          <Input
                            placeholder="Search substitutes..."
                            value={subSearch}
                            onChange={event => setSubSearch(event.target.value)}
                            onFocus={() => setIsSubSearchOpen(true)}
                            className="h-7 border-0 bg-slate-50 text-sm focus-visible:ring-0"
                          />
                        </div>
                        {isSubSearchOpen && (
                          <div className="max-h-60 overflow-y-auto p-2">
                            {filteredSubsForSearch.length === 0 ? (
                              <div className="p-2 text-xs text-muted-foreground">No matches</div>
                            ) : (
                              <div className="space-y-1">
                                {filteredSubsForSearch.map(sub => {
                                  const name = getDisplayName(sub)
                                  const canCover = selectedShift
                                    ? (sub.can_cover?.some(
                                        shift =>
                                          shift.date === selectedShift.date &&
                                          shift.time_slot_code === selectedShift.time_slot_code
                                      ) ?? false)
                                    : (sub.shifts_covered ?? 0) > 0 ||
                                      (sub.can_cover?.length ?? 0) > 0
                                  return (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                                      onClick={() => {
                                        if (!canCover && includeOnlyRecommended) {
                                          setIncludeOnlyRecommended(false)
                                          applySubResults(allSubs, {
                                            useOnlyRecommended: false,
                                          })
                                          toast(
                                            'Turning off “Include only recommended subs” to show this selection.'
                                          )
                                          setTimeout(() => scrollToSubCard(sub.id), 50)
                                        } else {
                                          scrollToSubCard(sub.id)
                                        }
                                        setSelectedSubIds(prev =>
                                          prev.includes(sub.id) ? prev : [...prev, sub.id]
                                        )
                                        setSubSearch('')
                                        setIsSubSearchOpen(false)
                                      }}
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${canCover ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                      />
                                      <span>{name.trim()}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <RecommendedSubsList
                    subs={rightPanelSubs}
                    loading={loading}
                    absence={absenceForUI ?? selectedAbsence}
                    shiftDetails={shiftDetails}
                    showAllSubs
                    onContactSub={handleContactSub}
                    onSaveNote={handleSaveSubNote}
                    hideHeader
                    highlightedSubId={highlightedSubId}
                    includePastShifts={includePastShifts}
                    selectedShift={selectedShift}
                    activeFilter={rightPanelActiveFilter}
                    onActiveFilterChange={setRightPanelActiveFilter}
                    hideFilterControls
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Select a sub or shift to begin.</div>
            )}
          </div>
        )}
      </div>

      <div
        className="hidden md:flex h-full"
        style={{
          width: isLeftRailCollapsed ? '3.5rem' : '26rem',
          minWidth: isLeftRailCollapsed ? '3.5rem' : '26rem',
          maxWidth: isLeftRailCollapsed ? '3.5rem' : '26rem',
          filter: isRightPanelOpen && !isContactPanelOpen ? 'brightness(0.9)' : undefined,
        }}
      >
        {renderLeftRail(isLeftRailCollapsed, true)}
      </div>

      <div className="hidden md:flex flex-1 flex-col md:flex-row items-stretch">
        {/* Middle Column */}
        <div
          className={cn(
            'relative flex-1 min-w-0 border-x bg-white transition-opacity h-full overflow-y-auto',
            SHOW_MIDDLE_COLUMN_DEBUG_BORDERS &&
              'outline outline-4 outline-red-500/90 outline-offset-[-4px] bg-red-50/20'
          )}
          style={{
            filter: isRightPanelOpen && !isContactPanelOpen ? 'brightness(0.9)' : undefined,
          }}
        >
          {SHOW_MIDDLE_COLUMN_DEBUG_BORDERS && (
            <div className="pointer-events-none absolute left-2 top-2 z-50 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              OUTER
            </div>
          )}
          <div
            className={cn(
              'relative w-full max-w-[1000px] px-8 md:px-10 lg:px-12',
              SHOW_MIDDLE_COLUMN_DEBUG_BORDERS &&
                'outline outline-4 outline-blue-500/90 outline-offset-[-4px] bg-blue-50/20'
            )}
          >
            {SHOW_MIDDLE_COLUMN_DEBUG_BORDERS && (
              <div className="pointer-events-none absolute left-2 top-2 z-50 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                INNER
              </div>
            )}
            {/* Fixed Header Bar */}
            {selectedAbsence && (
              <>
                <div
                  className="mt-6 border-b border-slate-200 bg-white"
                  style={middleColumnContentStyle}
                >
                  <div className="pt-10 pb-0">
                    {/* Header Row */}
                    <div className="mb-5">
                      <h2 className="text-xl font-semibold flex flex-wrap items-center gap-2">
                        <span>Sub Finder</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{selectedAbsence.teacher_name}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>
                          {formatAbsenceDateRange(
                            selectedAbsence.start_date,
                            selectedAbsence.end_date
                          )}
                        </span>
                        <span className="h-4 w-px bg-slate-500 mx-2" />
                        {selectedClassrooms.length > 0 ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            {selectedClassrooms.map(classroom => (
                              <span
                                key={classroom.id || classroom.name}
                                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                style={getClassroomPillStyle(classroom.color)}
                              >
                                {classroom.name}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-xs font-normal text-muted-foreground">
                            Classroom unavailable
                          </span>
                        )}
                      </h2>
                    </div>

                    {visibleShiftSummary && visibleShiftSummary.total > 0 && (
                      <div className="mt-4 mb-2 flex flex-wrap items-end justify-between gap-4">
                        <CoverageSummary
                          shifts={visibleShiftSummary}
                          onShiftClick={handleShiftClick}
                          variant="compact"
                          headerText={coverageSummaryLine ?? undefined}
                        />
                        <Button
                          onClick={handleRerunFinder}
                          disabled={loading}
                          size="sm"
                          variant="outline"
                          className="w-auto justify-center"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                          Rerun Finder
                        </Button>
                      </div>
                    )}

                    {showPastShiftsBanner && (
                      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-900">
                        <p className="max-w-3xl leading-snug">
                          This absence includes <strong>{pastShiftCount}</strong> past shift
                          {pastShiftCount === 1 ? '' : 's'} and{' '}
                          <strong>{upcomingShiftCount}</strong> upcoming shift
                          {upcomingShiftCount === 1 ? '' : 's'}.{' '}
                          {includePastShifts
                            ? 'Showing all shifts.'
                            : 'Showing upcoming shifts only.'}
                        </p>
                        <label
                          htmlFor="include-past-shifts"
                          className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900"
                        >
                          <Switch
                            id="include-past-shifts"
                            checked={includePastShifts}
                            onCheckedChange={setIncludePastShifts}
                          />
                          Include past shifts
                        </label>
                      </div>
                    )}

                    {/* Toolbar moved to right column */}
                  </div>
                </div>
              </>
            )}

            {selectedAbsence && (
              <div
                className={cn(
                  'relative w-full py-6 flex flex-col gap-6',
                  SHOW_MIDDLE_COLUMN_DEBUG_BORDERS && 'border-2 border-emerald-500 bg-emerald-50/10'
                )}
                style={middleColumnContentStyle}
              >
                {SHOW_MIDDLE_COLUMN_DEBUG_BORDERS && (
                  <div className="pointer-events-none absolute right-2 top-2 z-50 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    CONTENT
                  </div>
                )}
                {ENABLE_COLLAPSE_RECOMMENDED_ON_SHIFT &&
                selectedShift &&
                !showRecommendedWhenShiftSelected ? (
                  <button
                    type="button"
                    onClick={() => setShowRecommendedWhenShiftSelected(true)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-100 bg-amber-50/40 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50"
                  >
                    <span>Show recommended subs</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                ) : loading ? (
                  renderRecommendedPlaceholder()
                ) : displayRecommendedCombinations.length > 0 ? (
                  <div className="mt-2">
                    <RecommendedCombination
                      combinations={displayRecommendedCombinations}
                      onContactSub={handleCombinationContact}
                      totalShifts={visibleShiftSummary?.total ?? selectedAbsence.shifts.total}
                      useRemainingLabel={
                        (visibleShiftSummary?.total ?? selectedAbsence.shifts.total) >
                        (visibleShiftSummary?.uncovered ?? selectedAbsence.shifts.uncovered)
                      }
                      allSubs={allSubs}
                      allShifts={visibleShiftDetails}
                      includePastShifts={includePastShifts}
                      onShowAllSubs={openAllSubsPanel}
                    />
                  </div>
                ) : null}

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMiddleShiftListExpanded(prev => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {isMiddleShiftListExpanded ? 'Hide shifts' : 'Show all shifts'}
                    {isMiddleShiftListExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {isMiddleShiftListExpanded && (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="hidden md:flex flex-wrap gap-2 md:flex-row md:items-center">
                        {primaryShiftFilters.map(option => {
                          const isActive = shiftFilters.includes(option.key)
                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => toggleShiftFilter(option.key)}
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                isActive
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-400 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                              )}
                            >
                              {option.label} ({option.count})
                            </button>
                          )
                        })}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              className={cn(
                                'h-auto rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                hasActiveMoreShiftFilter
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-400 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                              )}
                            >
                              More filters
                              <ChevronDown className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start">
                            <div className="space-y-1">
                              {moreShiftFilters.map(option => {
                                const isActive = shiftFilters.includes(option.key)
                                return (
                                  <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => toggleShiftFilter(option.key)}
                                    className={cn(
                                      'flex w-full items-center justify-between rounded px-2 py-1.5 text-sm',
                                      isActive
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-700 hover:bg-slate-100'
                                    )}
                                  >
                                    <span>{option.label}</span>
                                    <span
                                      className={cn(
                                        'text-xs',
                                        isActive ? 'text-white/90' : 'text-slate-500'
                                      )}
                                    >
                                      {option.count}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="md:hidden">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-between">
                              Filters ({shiftFilters.length})
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72" align="start">
                            <div className="space-y-2">
                              {shiftFilterOptions.map(option => {
                                const isActive = shiftFilters.includes(option.key)
                                return (
                                  <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => toggleShiftFilter(option.key)}
                                    className={cn(
                                      'flex w-full items-center justify-between rounded px-2 py-1.5 text-sm',
                                      isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                                    )}
                                  >
                                    <span>{option.label}</span>
                                    <span className="text-xs text-slate-500">{option.count}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {filteredShiftDetails.length > 0 ? (
                      filteredShiftDetails.map(shift => (
                        <ShiftStatusCard
                          key={shift.id}
                          shift={shift}
                          teacherName={selectedAbsence.teacher_name}
                          contactedAvailableSubCount={
                            contactedAvailableSubCountByShift.get(
                              `${shift.date}|${shift.time_slot_code}`
                            ) || 0
                          }
                          responseSummary={
                            responseSummaryByShift.get(`${shift.date}|${shift.time_slot_code}`) ||
                            'No response'
                          }
                          onSelectShift={handleSelectShift}
                          onChangeSub={handleSelectShift}
                          onRemoveSub={handleOpenRemoveDialog}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                        No shifts to display.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Middle column content ends above */}
          </div>
        </div>

        {/* Right Column */}
        {isRightPanelOpen && (
          <div
            ref={rightPanelRef}
            className={cn(
              'shrink-0 flex-none border-l bg-white transition-all h-full overflow-hidden',
              SHOW_RIGHT_PANEL_DEBUG_BORDERS && 'border-2 border-rose-500'
            )}
            style={{ width: '540px' }}
          >
            {selectedAbsence ? (
              <div
                className={cn(
                  'h-full flex flex-col',
                  SHOW_RIGHT_PANEL_DEBUG_BORDERS && 'border-2 border-orange-500'
                )}
              >
                <div className="shrink-0 flex justify-end px-8 pt-4">
                  <button
                    type="button"
                    onClick={closeRightPanel}
                    aria-label="Close"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className={cn(
                    'mt-0 shrink-0 border-b border-slate-200 bg-white px-8 pt-3 pb-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]',
                    SHOW_RIGHT_PANEL_DEBUG_BORDERS && 'border-2 border-blue-500'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      {selectedShift ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold text-slate-900">
                              {`Subs for ${formatShortDate(selectedShift.date)} • ${selectedShift.time_slot_code}`}
                            </span>
                            {selectedShift.classroom_name ? (
                              <span
                                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                style={getClassroomPillStyle(selectedShift.classroom_color ?? null)}
                              >
                                {selectedShift.classroom_name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Classroom unavailable
                              </span>
                            )}
                          </div>
                          {ENABLE_SHIFT_FOCUS_MODE && (
                            <p className="text-sm text-slate-600">
                              {selectedShiftMatchCount} can cover this shift · {allSubs.length}{' '}
                              total subs
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="text-lg font-semibold text-slate-900">
                            Subs for {selectedAbsence.teacher_name}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                            <span>
                              {formatAbsenceDateRange(
                                selectedAbsence.start_date,
                                selectedAbsence.end_date
                              )}
                            </span>
                            {selectedClassrooms.length > 0 ? (
                              <span className="flex flex-wrap items-center gap-1.5">
                                {selectedClassrooms.map(classroom => (
                                  <span
                                    key={classroom.id || classroom.name}
                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                    style={getClassroomPillStyle(classroom.color)}
                                  >
                                    {classroom.name}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Classroom unavailable
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={cn(
                      'pt-3 space-y-2',
                      SHOW_RIGHT_PANEL_DEBUG_BORDERS && 'border-2 border-purple-500'
                    )}
                  >
                    <div
                      ref={subSearchRef}
                      className={cn(
                        'rounded-md border border-slate-200 bg-white',
                        SHOW_RIGHT_PANEL_DEBUG_BORDERS && 'border-2 border-emerald-500'
                      )}
                    >
                      <div className="p-1.5">
                        <Input
                          placeholder="Search substitutes..."
                          value={subSearch}
                          onChange={event => setSubSearch(event.target.value)}
                          onFocus={() => setIsSubSearchOpen(true)}
                          className="h-7 border-0  text-sm focus-visible:ring-0"
                        />
                      </div>
                      {isSubSearchOpen && (
                        <div className="max-h-60 overflow-y-auto p-2">
                          {filteredSubsForSearch.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">No matches</div>
                          ) : (
                            <div className="space-y-1">
                              {filteredSubsForSearch.map(sub => {
                                const name = getDisplayName(sub)
                                const canCover = selectedShift
                                  ? (sub.can_cover?.some(
                                      shift =>
                                        shift.date === selectedShift.date &&
                                        shift.time_slot_code === selectedShift.time_slot_code
                                    ) ?? false)
                                  : (sub.shifts_covered ?? 0) > 0 ||
                                    (sub.can_cover?.length ?? 0) > 0
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                                    onClick={() => {
                                      if (!canCover && includeOnlyRecommended) {
                                        setIncludeOnlyRecommended(false)
                                        applySubResults(allSubs, {
                                          useOnlyRecommended: false,
                                        })
                                        toast(
                                          'Turning off “Include only recommended subs” to show this selection.'
                                        )
                                        setTimeout(() => scrollToSubCard(sub.id), 50)
                                      } else {
                                        scrollToSubCard(sub.id)
                                      }
                                      setSelectedSubIds(prev =>
                                        prev.includes(sub.id) ? prev : [...prev, sub.id]
                                      )
                                      setSubSearch('')
                                      setIsSubSearchOpen(false)
                                    }}
                                  >
                                    <span
                                      className={`h-2 w-2 rounded-full ${canCover ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                    />
                                    <span>{name.trim()}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedSubChips.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      {selectedSubChips.map(chip => (
                        <span
                          key={chip.id}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                        >
                          {chip.name}
                          <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600"
                            aria-label={`Remove ${chip.name}`}
                            onClick={() =>
                              setSelectedSubIds(prev => prev.filter(id => id !== chip.id))
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-4">
                    <RecommendedSubsList
                      subs={rightPanelSubs}
                      loading={loading}
                      absence={absenceForUI ?? selectedAbsence}
                      shiftDetails={shiftDetails}
                      showAllSubs
                      hideHeader
                      includePastShifts={includePastShifts}
                      selectedShift={selectedShift}
                      activeFilter={rightPanelActiveFilter}
                      onActiveFilterChange={setRightPanelActiveFilter}
                      renderFiltersOnly
                      className="space-y-0"
                    />
                  </div>
                </div>

                <div
                  className={cn(
                    'min-h-0 flex-1 overflow-y-auto px-8 pb-6',
                    SHOW_RIGHT_PANEL_DEBUG_BORDERS && 'border-2 border-cyan-500'
                  )}
                >
                  <RecommendedSubsList
                    subs={rightPanelSubs}
                    loading={loading}
                    absence={absenceForUI ?? selectedAbsence}
                    shiftDetails={shiftDetails}
                    showAllSubs
                    onContactSub={handleContactSub}
                    onSaveNote={handleSaveSubNote}
                    hideHeader
                    highlightedSubId={highlightedSubId}
                    includePastShifts={includePastShifts}
                    selectedShift={selectedShift}
                    stickyControls
                    activeFilter={rightPanelActiveFilter}
                    onActiveFilterChange={setRightPanelActiveFilter}
                    hideFilterControls
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <Dialog
          open={Boolean(removeDialogShift)}
          onOpenChange={open => {
            if (!open) {
              handleCloseRemoveDialog()
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove sub assignment?</DialogTitle>
              <DialogDescription>
                {removeDialogHasMultiple
                  ? `Would you like to remove ${removeDialogSubName} from only this shift, or from all shifts for ${removeDialogTeacherName} on this request?`
                  : `Are you sure you want to remove ${removeDialogSubName} from this shift?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseRemoveDialog}
                disabled={Boolean(removingScope)}
              >
                Cancel
              </Button>
              {removeDialogHasMultiple && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRemoveSubAssignment('all_for_absence')}
                  disabled={Boolean(removingScope)}
                >
                  {removingScope === 'all_for_absence' ? 'Removing...' : 'All shifts'}
                </Button>
              )}
              <Button
                type="button"
                onClick={() => handleRemoveSubAssignment('single')}
                disabled={Boolean(removingScope)}
              >
                {removingScope === 'single' ? 'Removing...' : 'This shift only'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isContactPanelOpen && selectedAbsence && selectedSub && (
          <ContactSubPanel
            isOpen={isContactPanelOpen}
            onClose={closeContactPanel}
            sub={selectedSub as RecommendedSub}
            absence={selectedAbsence}
            variant="sheet"
            onChangeShift={shift => {
              const match = selectedAbsence.shifts.shift_details.find(
                detail =>
                  detail.date === shift.date && detail.time_slot_code === shift.time_slot_code
              )
              if (match) {
                handleSelectShift(match)
                return
              }
              toast.error('Unable to locate that shift. Try refreshing and retrying.')
            }}
            initialContactData={
              selectedSub && selectedAbsence
                ? contactDataCache.get(getCacheKey(selectedSub.id, selectedAbsence.id))
                : undefined
            }
            onAssignmentComplete={async () => {
              if (selectedAbsence) {
                setContactDataCache(prev => {
                  const next = new Map(prev)
                  for (const [key] of next) {
                    if (key.endsWith(`-${selectedAbsence.id}`)) {
                      next.delete(key)
                    }
                  }
                  return next
                })
              }
              await fetchAbsences()
              if (selectedAbsence) {
                await runFinderForAbsence(selectedAbsence)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
