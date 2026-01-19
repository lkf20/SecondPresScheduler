'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RefreshCw, Search, Settings2, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import AbsenceList from '@/components/sub-finder/AbsenceList'
import RecommendedSubsList from '@/components/sub-finder/RecommendedSubsList'
import RecommendedCombination from '@/components/sub-finder/RecommendedCombination'
import ContactSubPanel from '@/components/sub-finder/ContactSubPanel'
import CoverageSummary from '@/components/sub-finder/CoverageSummary'
import {
  useSubFinderData,
  type Mode,
  type Absence,
  type SubCandidate,
} from '@/components/sub-finder/hooks/useSubFinderData'
import ShiftSelectionTable from '@/components/time-off/ShiftSelectionTable'
import DatePickerInput from '@/components/ui/date-picker-input'
import { parseLocalDate } from '@/lib/utils/date'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePanelManager } from '@/lib/contexts/PanelManagerContext'
import { saveSubFinderState, loadSubFinderState } from '@/lib/utils/sub-finder-state'

export default function SubFinderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedAbsenceId = searchParams.get('absence_id')
  const requestedTeacherId = searchParams.get('teacher_id')
  const [mode, setMode] = useState<Mode>('existing')
  const {
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
  } = useSubFinderData({ 
    mode, 
    requestedAbsenceId,
    skipInitialFetch: true, // Skip initial fetch to allow state restoration first
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [teacherSearchInput, setTeacherSearchInput] = useState('') // Separate state for dropdown input
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]) // Array of selected teacher IDs
  const [subSearch, setSubSearch] = useState('')
  const [isSubSearchOpen, setIsSubSearchOpen] = useState(false)
  const [selectedSub, setSelectedSub] = useState<SubCandidate | null>(null)
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false)
  const [isTeacherSearchOpen, setIsTeacherSearchOpen] = useState(false)
  const { setActivePanel, previousPanel, restorePreviousPanel, registerPanelCloseHandler } = usePanelManager()
  const savedSubRef = useRef<SubCandidate | null>(null)
  const savedAbsenceRef = useRef<Absence | null>(null)
  // Cache contact data: key = `${subId}-${absenceId}`
  const [contactDataCache, setContactDataCache] = useState<Map<string, Record<string, unknown>>>(new Map())
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
  const manualEndDateRef = useRef<HTMLButtonElement | null>(null)
  const [endDateCorrected, setEndDateCorrected] = useState(false)
  const correctionTimeoutRef = useRef<number | null>(null)
  const isFlexibleStaffChangeUserInitiatedRef = useRef(false)
  const isRestoringStateRef = useRef(false) // Track if we're restoring state to avoid saving during restoration
  const hasRestoredStateRef = useRef(false) // Track if we've completed initial state restoration
  const runManualFinder = async () => {
    if (!manualTeacherId || !manualStartDate || manualSelectedShifts.length === 0) return
    setHighlightedSubId(null)
    await handleFindManualSubs({
      teacherId: manualTeacherId,
      startDate: manualStartDate,
      endDate: manualEndDate || manualStartDate,
      shifts: manualSelectedShifts,
    })
  }
  const selectedClassrooms = useMemo(() => {
    if (!selectedAbsence) return []
    if (Array.isArray((selectedAbsence as { classrooms?: Array<{ id: string; name: string; color: string | null }> }).classrooms)) {
      return (selectedAbsence as { classrooms: Array<{ id: string; name: string; color: string | null }> }).classrooms
    }
    return Array.from(
      new Set(
        selectedAbsence.shifts.shift_details
          .map((shift) => shift.classroom_name)
          .filter((name): name is string => Boolean(name))
      )
    ).map((name) => ({ id: name, name, color: null }))
  }, [selectedAbsence])
  const sortedSubs = useMemo(() => {
    return [...allSubs].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
  }, [allSubs, getDisplayName])
  const filteredSubsForSearch = useMemo(() => {
    const query = subSearch.trim().toLowerCase()
    if (!query) return sortedSubs
    return sortedSubs.filter((sub) => {
      return getDisplayName(sub, '').toLowerCase().includes(query)
    })
  }, [sortedSubs, subSearch, getDisplayName])
  const filteredManualTeachers = useMemo(() => {
    const query = manualTeacherSearch.trim().toLowerCase()
    if (!query) return teachers
    return teachers.filter((teacher) => {
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
    await handleFindSubs(selectedAbsence)
  }

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
    
    // Prefetch contact data in background if we have an absence
    if (selectedAbsence) {
      fetchContactDataForSub(sub, selectedAbsence).catch(error => {
        console.error('Error prefetching contact data:', error)
      })
    }
  }

  const handleViewDetails = async (sub: SubCandidate) => {
    setSelectedSub(sub)
    setIsContactPanelOpen(true)
    
    // Prefetch contact data in background if we have an absence
    if (selectedAbsence) {
      fetchContactDataForSub(sub, selectedAbsence).catch(error => {
        console.error('Error prefetching contact data:', error)
      })
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

  const handleCloseContactPanel = () => {
    setIsContactPanelOpen(false)
    setActivePanel(null)
    setSelectedSub(null)
  }

  // Handle panel restoration when Add Time Off closes
  useEffect(() => {
    if (previousPanel?.type === 'contact-sub' && !isContactPanelOpen && savedSubRef.current && savedAbsenceRef.current) {
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
  }, [isContactPanelOpen, selectedSub, selectedAbsence, setActivePanel, registerPanelCloseHandler, setSelectedAbsence])

  // Wrapper for setIncludeFlexibleStaff that marks change as user-initiated
  const handleFlexibleStaffChange = (checked: boolean) => {
    isFlexibleStaffChangeUserInitiatedRef.current = true
    setIncludeFlexibleStaff(checked)
  }

  // Auto-rerun Finder when includeFlexibleStaff changes (user-initiated only)
  useEffect(() => {
    if (isFlexibleStaffChangeUserInitiatedRef.current && selectedAbsence && mode === 'existing') {
      isFlexibleStaffChangeUserInitiatedRef.current = false // Reset flag
      handleFindSubs(selectedAbsence)
    } else if (isFlexibleStaffChangeUserInitiatedRef.current) {
      // Reset flag even if we don't rerun (e.g., no selected absence)
      isFlexibleStaffChangeUserInitiatedRef.current = false
    }
  }, [includeFlexibleStaff, selectedAbsence, mode, handleFindSubs])

  // Handler for combination contact button
  const handleCombinationContact = (subId: string) => {
    const sub = allSubs.find((s) => s.id === subId)
    if (sub) {
      handleContactSub(sub)
    }
  }

  // Handle shift click to scroll to sub card
  const handleShiftClick = (shift: Absence['shifts']['shift_details'][number]) => {
    if (!shift.sub_name) return
    
    // Find the sub in recommendedSubs by matching assigned shifts
    const sub = recommendedSubs.find((s) => {
      return s.assigned_shifts?.some((as) => 
        as.date === shift.date && as.time_slot_code === shift.time_slot_code
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
      filtered = filtered.filter((absence) => selectedTeacherIds.includes(absence.teacher_id))
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
    if (savedState.subSearch) {
      setSubSearch(savedState.subSearch)
    }

    // Restore absences if available (this prevents unnecessary fetch)
    const hasSavedAbsences = savedState.absences && savedState.absences.length > 0
    if (hasSavedAbsences) {
      setAbsences(savedState.absences)
    }

    hasRestoredStateRef.current = true
    // Reset flag after a short delay to allow other effects to run
    setTimeout(() => {
      isRestoringStateRef.current = false
      // Only fetch absences if we're in existing mode and don't have them in saved state
      if (mode === 'existing' && !hasSavedAbsences) {
        fetchAbsences()
      }
    }, 500) // Give enough time for all restoration effects to complete
  }, []) // Only run on mount - eslint-disable-line react-hooks/exhaustive-deps


  // Restore selected absence after absences are loaded (for existing mode)
  useEffect(() => {
    if (requestedAbsenceId || mode !== 'existing') return // URL param takes precedence, or skip if manual mode

    const savedState = loadSubFinderState()
    if (!savedState?.selectedAbsenceId || selectedAbsence) return // Skip if already have selected absence

    // Check if it's a manual mode absence (starts with 'manual-')
    if (savedState.selectedAbsenceId.startsWith('manual-')) {
      // This is handled in manual mode restoration
      return
    }

    // Find the absence in the current absences list
    const absence = absences.find(a => a.id === savedState.selectedAbsenceId)
    if (absence) {
      isRestoringStateRef.current = true
      setSelectedAbsence(absence)
      
      // If we have saved results, restore them; otherwise re-run finder
      if (savedState.recommendedSubs && savedState.recommendedSubs.length > 0) {
        // Restore saved results
        applySubResults(savedState.allSubs || savedState.recommendedSubs, {
          useOnlyRecommended: savedState.includeOnlyRecommended ?? true,
        })
        if (savedState.recommendedCombinations && savedState.recommendedCombinations.length > 0) {
          setRecommendedCombinations(savedState.recommendedCombinations)
        }
        isRestoringStateRef.current = false
        hasRestoredStateRef.current = true
      } else {
        // No saved results, re-run finder to get fresh data
        setTimeout(() => {
          handleFindSubs(absence).finally(() => {
            isRestoringStateRef.current = false
            hasRestoredStateRef.current = true
          })
        }, 100)
      }
    }
  }, [absences, requestedAbsenceId, mode, selectedAbsence, setSelectedAbsence, handleFindSubs, applySubResults, setRecommendedCombinations])

  // Restore manual mode results after form data is restored
  useEffect(() => {
    if (mode !== 'manual' || !manualTeacherId || !manualStartDate || manualSelectedShifts.length === 0) return
    if (selectedAbsence) return // Already have an absence, skip

    const savedState = loadSubFinderState()
    if (!savedState) return

    // Check if we have saved results for manual mode
    const expectedAbsenceId = `manual-${manualTeacherId}`
    if (savedState.selectedAbsenceId === expectedAbsenceId && savedState.recommendedSubs && savedState.recommendedSubs.length > 0) {
      isRestoringStateRef.current = true
      
      // Create synthetic absence to match saved state
      const teacher = teachers.find(t => t.id === manualTeacherId)
      const teacherName = getDisplayName(teacher, 'Manual Coverage')
      
      // Restore results
      applySubResults(savedState.allSubs || savedState.recommendedSubs, {
        useOnlyRecommended: savedState.includeOnlyRecommended ?? true,
      })
      if (savedState.recommendedCombinations && savedState.recommendedCombinations.length > 0) {
        setRecommendedCombinations(savedState.recommendedCombinations)
      }
      
      // Create synthetic absence (minimal data since we have results)
      setSelectedAbsence({
        id: expectedAbsenceId,
        teacher_id: manualTeacherId,
        teacher_name: teacherName,
        start_date: manualStartDate,
        end_date: manualEndDate || manualStartDate,
        reason: null,
        shifts: {
          total: manualSelectedShifts.length,
          uncovered: manualSelectedShifts.length,
          partially_covered: 0,
          fully_covered: 0,
          shift_details: [],
        },
      })
      
      isRestoringStateRef.current = false
      hasRestoredStateRef.current = true
    }
  }, [mode, manualTeacherId, manualStartDate, manualEndDate, manualSelectedShifts, selectedAbsence, teachers, getDisplayName, applySubResults, setRecommendedCombinations, setSelectedAbsence])

  // Save state whenever it changes (but not during restoration or before initial restoration)
  useEffect(() => {
    if (isRestoringStateRef.current || !hasRestoredStateRef.current) return
    saveSubFinderState({
      mode,
      selectedTeacherIds,
      selectedAbsenceId: selectedAbsence?.id || null,
      manualTeacherId,
      manualStartDate,
      manualEndDate,
      manualSelectedShifts,
      includePartiallyCovered,
      includeFlexibleStaff,
      includeOnlyRecommended,
      subSearch,
      absences: absences.length > 0 ? absences : undefined,
      recommendedSubs: recommendedSubs.length > 0 ? recommendedSubs : undefined,
      allSubs: allSubs.length > 0 ? allSubs : undefined,
      recommendedCombinations: recommendedCombinations.length > 0 ? recommendedCombinations : undefined,
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
    subSearch,
    absences,
    recommendedSubs,
    allSubs,
    recommendedCombinations,
  ])

  return (
    <div className="flex h-[calc(100vh-4rem+1.5rem+4rem)] -mx-4 -mt-[calc(1.5rem+4rem)] -mb-6 relative">
      {/* Left Rail */}
      <div className="w-80 border-r border-slate-200 bg-slate-100 shadow-[2px_0_6px_rgba(0,0,0,0.03)] flex flex-col overflow-hidden">
        <div className="sticky top-0 z-10 px-3 pt-10 pb-4 border-b border-slate-200 bg-slate-100 flex flex-col">
          <h1 className="text-xl font-bold mb-4 text-slate-900 pl-2">Sub Finder</h1>

          {/* Mode Toggle - Pill */}
          <div className="mb-4 rounded-full border border-slate-200 bg-white/70 p-1">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode('existing')}
                className={cn(
                  "flex-1 rounded-full text-xs font-semibold transition-all",
                  mode === 'existing'
                    ? "!bg-button-fill !text-button-fill-foreground shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                )}
              >
                Existing Absences
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode('manual')}
                className={cn(
                  "flex-1 rounded-full text-xs font-semibold transition-all",
                  mode === 'manual'
                    ? "!bg-button-fill !text-button-fill-foreground shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
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
                          .filter((name) => {
                            const query = teacherSearchInput.toLowerCase()
                            // If there's a query in the dropdown input, filter by it. Otherwise show all teachers
                            return !query || name.toLowerCase().includes(query)
                          })
                          .map((name) => {
                            const teacher = teachers.find(t => getDisplayName(t) === name)
                            const teacherId = teacher?.id
                            const isSelected = teacherId && selectedTeacherIds.includes(teacherId)
                            return (
                              <button
                                key={name}
                                type="button"
                                className={cn(
                                  "w-full rounded px-1.5 py-1 text-left text-sm text-slate-700 hover:bg-slate-100",
                                  isSelected && "bg-slate-100 opacity-60"
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
                        {teacherNames.filter((name) => {
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
                  {selectedTeacherIds.map((teacherId) => {
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
            <div className="space-y-2">
              <div>
                <Label className="text-sm">Teacher</Label>
                <div className="mt-1">
                  <div className="rounded-md border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-2 py-1">
                      <Input
                        placeholder="Search teachers..."
                        value={manualTeacherSearch}
                        onChange={(event) => setManualTeacherSearch(event.target.value)}
                        onFocus={() => setIsManualTeacherSearchOpen(true)}
                        onBlur={() => {
                          setTimeout(() => setIsManualTeacherSearchOpen(false), 150)
                        }}
                        className="h-8 border-0 bg-slate-50 text-sm focus-visible:ring-0"
                      />
                    </div>
                    {isManualTeacherSearchOpen && (
                      <div className="max-h-52 overflow-y-auto p-2">
                        {filteredManualTeachers.map((teacher) => {
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
                    onChange={(value) => {
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
                    onChange={(value) => {
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
                  onShiftsChange={(shifts) => {
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
                disabled={!manualTeacherId || !manualStartDate || manualSelectedShifts.length === 0}
                onClick={runManualFinder}
              >
                Find Subs
              </Button>
            </div>
          )}
        </div>

        {/* Absences List */}
        {mode === 'existing' && (
          <div className="flex-1 overflow-y-auto">
            <AbsenceList
              absences={filteredAbsences}
              selectedAbsence={selectedAbsence}
              onSelectAbsence={setSelectedAbsence}
              onFindSubs={handleFindSubs}
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden px-8">
        {/* Fixed Header Bar */}
        {selectedAbsence && (
          <>
            <div className="sticky top-0 z-10 border-b bg-white shadow-sm">
              <div className="px-6 pt-10 pb-2">
                {/* Header Row */}
                <div className="mb-5">
                  <h2 className="text-xl font-semibold flex flex-wrap items-center gap-2">
                    <span>Sub Finder</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{selectedAbsence.teacher_name}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>
                      {(() => {
                        const formatDate = (dateString: string) => {
                          const date = parseLocalDate(dateString)
                          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                          const dayName = dayNames[date.getDay()]
                          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                          const month = monthNames[date.getMonth()]
                          const day = date.getDate()
                          return `${dayName} ${month} ${day}`
                        }
                        const startDate = formatDate(selectedAbsence.start_date)
                        if (selectedAbsence.end_date && selectedAbsence.end_date !== selectedAbsence.start_date) {
                          const endDate = formatDate(selectedAbsence.end_date)
                          return (
                            <>
                              {startDate}
                              <span className="font-normal text-slate-500"> - </span>
                              {endDate}
                            </>
                          )
                        }
                        return startDate
                      })()}
                    </span>
                    <span className="h-4 w-px bg-slate-500 mx-2" />
                    {selectedClassrooms.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {selectedClassrooms.map((classroom) => (
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
                      <span className="text-xs font-normal text-muted-foreground">Classroom unavailable</span>
                    )}
                  </h2>
                </div>

                {selectedAbsence.shifts.total > 0 && (
                  <div className="mt-4 mb-8">
                    <CoverageSummary
                      shifts={selectedAbsence.shifts}
                      onShiftClick={handleShiftClick}
                    />
                  </div>
                )}

                {/* Toolbar Row */}
                <div className="flex items-end justify-between pb-3">
                  {/* Color Key - Left aligned, bottom aligned */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-3 h-3 rounded bg-blue-50"
                        style={{
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'rgb(96, 165, 250)', // blue-400
                        }}
                      />
                      <span>Covered</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-3 h-3 rounded bg-orange-50"
                        style={{
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'rgb(251, 146, 60)', // orange-400
                        }}
                      />
                      <span>Uncovered</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-3 h-3 rounded bg-emerald-50"
                        style={{
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'rgb(153, 246, 228)', // teal-200 (emerald-200 equivalent)
                        }}
                      />
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-3 h-3 rounded bg-gray-100"
                        style={{
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'rgb(209, 213, 219)', // gray-300
                        }}
                      />
                      <span>Unavailable</span>
                    </div>
                  </div>
                  {/* Buttons - Right aligned */}
                  <div className="flex items-center gap-3">
                    <Button onClick={handleRerunFinder} disabled={loading} size="sm" variant="outline">
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Rerun Finder
                    </Button>

                    <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="relative">
                        <Settings2 className="h-4 w-4 mr-2" />
                        Search & Filter
                        {(includePartiallyCovered || !includeOnlyRecommended || !includeFlexibleStaff) && (
                          <Badge
                            variant="secondary"
                            className="ml-2 h-5 min-w-[20px] px-1.5 text-xs"
                          >
                            {[
                              includePartiallyCovered,
                              !includeOnlyRecommended,
                              !includeFlexibleStaff,
                            ].filter(Boolean).length}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-80"
                      align="start"
                      onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Substitute</Label>
                          <div ref={subSearchRef} className="mt-2 rounded-md border border-slate-200 bg-white">
                            <div className="border-b border-slate-100 p-2">
                              <Input
                                placeholder="Search substitutes..."
                                value={subSearch}
                                onChange={(event) => setSubSearch(event.target.value)}
                                onFocus={() => setIsSubSearchOpen(true)}
                                className="h-8 border-0 bg-slate-50 text-sm focus-visible:ring-0"
                              />
                            </div>
                            {isSubSearchOpen && (
                              <div className="max-h-60 overflow-y-auto p-2">
                                {filteredSubsForSearch.length === 0 ? (
                                  <div className="p-2 text-xs text-muted-foreground">No matches</div>
                                ) : (
                                  <div className="space-y-1">
                                    {filteredSubsForSearch.map((sub) => {
                                      const name = getDisplayName(sub)
                                      const canCover = (sub.shifts_covered ?? 0) > 0 || (sub.can_cover?.length ?? 0) > 0
                                      return (
                                        <button
                                          key={sub.id}
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                                          onClick={() => {
                                            if (!canCover && includeOnlyRecommended) {
                                              setIncludeOnlyRecommended(false)
                                              applySubResults(allSubs, { useOnlyRecommended: false })
                                              toast('Turning off “Include only recommended subs” to show this selection.')
                                              setTimeout(() => scrollToSubCard(sub.id), 50)
                                            } else {
                                              scrollToSubCard(sub.id)
                                            }
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
                        <div>
                          <h4 className="font-medium text-sm mb-3">Filter Options</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <Label
                                  htmlFor="include-only-recommended"
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  Include only recommended subs
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Show only subs who can cover at least one shift
                                </p>
                              </div>
                              <Switch
                                id="include-only-recommended"
                                checked={includeOnlyRecommended}
                                onCheckedChange={setIncludeOnlyRecommended}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <Label
                                  htmlFor="include-partial"
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  Include partially covered shifts
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Show absences with partial coverage
                                </p>
                              </div>
                              <Switch
                                id="include-partial"
                                checked={includePartiallyCovered}
                                onCheckedChange={setIncludePartiallyCovered}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <Label
                                  htmlFor="include-flexible"
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  Include Flexible Staff
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Include staff who can sub when not teaching
                                </p>
                              </div>
                              <Switch
                                id="include-flexible"
                                checked={includeFlexibleStaff}
                                onCheckedChange={handleFlexibleStaffChange}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  </div>
                </div>
              </div>
            </div>

          </>
        )}

        {/* Recommended Combination and Subs List - now scrollable without header */}
        <div className="flex-1 overflow-y-auto">
          {selectedAbsence ? (
            <div className="p-4">
              {/* Recommended Combination Section */}
              {recommendedCombinations.length > 0 && (
                <div className="mt-2">
                  <RecommendedCombination
                    combinations={recommendedCombinations}
                    onContactSub={handleCombinationContact}
                    totalShifts={selectedAbsence.shifts.total}
                    useRemainingLabel={selectedAbsence.shifts.total > selectedAbsence.shifts.uncovered}
                    allSubs={allSubs}
                    allShifts={selectedAbsence.shifts.shift_details || []}
                  />
                  <div className="mt-16 text-sm font-semibold text-slate-700">All Available Subs</div>
                  <div className="mt-2 border-t border-slate-200 pt-6" />
                </div>
              )}

              <RecommendedSubsList
                subs={recommendedSubs}
                loading={loading}
                absence={selectedAbsence}
                showAllSubs={!includeOnlyRecommended}
                onContactSub={handleContactSub}
                onViewDetails={handleViewDetails}
                hideHeader
                highlightedSubId={highlightedSubId}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-2">Select an absence to find recommended subs</p>
                <p className="text-sm">
                  Choose an absence from the left panel to see available substitutes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Sub Panel */}
      {selectedAbsence && (
        <ContactSubPanel
          isOpen={isContactPanelOpen}
          onClose={handleCloseContactPanel}
          sub={selectedSub}
          absence={selectedAbsence}
          initialContactData={
            selectedSub && selectedAbsence
              ? contactDataCache.get(getCacheKey(selectedSub.id, selectedAbsence.id))
              : undefined
          }
          onAssignmentComplete={async () => {
            // Invalidate ALL contact caches for this absence to ensure all subs refresh
            // This is important when a sub's status changes (e.g., from declined to not declined)
            if (selectedAbsence) {
              // Clear all cached contact data for this absence
              setContactDataCache(prev => {
                const next = new Map(prev)
                // Remove all entries where the key ends with this absence ID
                for (const [key] of next) {
                  if (key.endsWith(`-${selectedAbsence.id}`)) {
                    next.delete(key)
                  }
                }
                return next
              })
            }
            
            // Refresh absences to update coverage status
            await fetchAbsences()
            // Refresh recommended subs if we have a selected absence
            // This will also recalculate the combination and properly categorize
            // subs based on their updated response_status
            if (selectedAbsence) {
              await handleFindSubs(selectedAbsence)
            }
          }}
        />
      )}
    </div>
  )
}
