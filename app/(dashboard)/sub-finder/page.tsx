'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChevronDown, RefreshCw, Search, Settings2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import AbsenceList from '@/components/sub-finder/AbsenceList'
import RecommendedSubsList from '@/components/sub-finder/RecommendedSubsList'
import RecommendedCombination from '@/components/sub-finder/RecommendedCombination'
import ContactSubPanel from '@/components/sub-finder/ContactSubPanel'
import CoverageSummary from '@/components/sub-finder/CoverageSummary'
import ShiftSelectionTable from '@/components/time-off/ShiftSelectionTable'
import DatePickerInput from '@/components/ui/date-picker-input'
import { parseLocalDate } from '@/lib/utils/date'
import { findBestCombination } from '@/lib/utils/sub-combination'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Mode = 'existing' | 'manual'

interface Absence {
  id: string
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  reason: string | null
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
  }
}

interface Teacher {
  id: string
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  active?: boolean | null
}

export default function SubFinderPage() {
  const searchParams = useSearchParams()
  const requestedAbsenceId = searchParams.get('absence_id')
  const hasAppliedAbsenceRef = useRef(false)
  const [mode, setMode] = useState<Mode>('existing')
  const [absences, setAbsences] = useState<Absence[]>([])
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null)
  const [recommendedSubs, setRecommendedSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [includePartiallyCovered, setIncludePartiallyCovered] = useState(false)
  const [includeFlexibleStaff, setIncludeFlexibleStaff] = useState(true)
  const [includeOnlyRecommended, setIncludeOnlyRecommended] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [subSearch, setSubSearch] = useState('')
  const [isSubSearchOpen, setIsSubSearchOpen] = useState(false)
  const [allSubs, setAllSubs] = useState<any[]>([]) // Store all subs from API
  const [selectedSub, setSelectedSub] = useState<any | null>(null)
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false)
  const [isTeacherSearchOpen, setIsTeacherSearchOpen] = useState(false)
  // Cache contact data: key = `${subId}-${absenceId}`
  const [contactDataCache, setContactDataCache] = useState<Map<string, any>>(new Map())
  const [recommendedCombination, setRecommendedCombination] = useState<any>(null)
  const [highlightedSubId, setHighlightedSubId] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [manualTeacherId, setManualTeacherId] = useState<string>('')
  const [manualStartDate, setManualStartDate] = useState<string>('')
  const [manualEndDate, setManualEndDate] = useState<string>('')
  const [manualSelectedShifts, setManualSelectedShifts] = useState<
    Array<{ date: string; day_of_week_id: string; time_slot_id: string }>
  >([])
  const [manualTeacherSearch, setManualTeacherSearch] = useState('')
  const [isManualTeacherSearchOpen, setIsManualTeacherSearchOpen] = useState(false)
  const subSearchRef = useRef<HTMLDivElement | null>(null)
  const manualEndDateRef = useRef<HTMLInputElement | null>(null)
  const [endDateCorrected, setEndDateCorrected] = useState(false)
  const justCorrectedRef = useRef(false)
  const selectedClassrooms = selectedAbsence
    ? Array.from(
        new Set(
          selectedAbsence.shifts.shift_details
            .map((shift) => shift.classroom_name)
            .filter((name): name is string => Boolean(name))
        )
      )
    : []
  const sortedSubs = useMemo(() => {
    const displayName = (sub: any) =>
      (sub.display_name || sub.name || `${sub.first_name ?? ''} ${sub.last_name ?? ''}` || 'Unknown').trim()
    return [...allSubs].sort((a, b) => displayName(a).localeCompare(displayName(b)))
  }, [allSubs])
  const filteredSubsForSearch = useMemo(() => {
    const query = subSearch.trim().toLowerCase()
    if (!query) return sortedSubs
    return sortedSubs.filter((sub) => {
      const name = (sub.display_name || sub.name || `${sub.first_name ?? ''} ${sub.last_name ?? ''}` || '').toLowerCase()
      return name.includes(query)
    })
  }, [sortedSubs, subSearch])
  const filteredManualTeachers = useMemo(() => {
    const query = manualTeacherSearch.trim().toLowerCase()
    if (!query) return teachers
    return teachers.filter((teacher) => {
      const name = (teacher.display_name || `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}` || '').toLowerCase()
      return name.includes(query)
    })
  }, [teachers, manualTeacherSearch])

  // Fetch absences on mount and when filters change
  useEffect(() => {
    if (mode === 'existing') {
      fetchAbsences()
    }
  }, [mode, includePartiallyCovered])

  useEffect(() => {
    if (!requestedAbsenceId) return
    if (hasAppliedAbsenceRef.current) return
    if (absences.length === 0) return
    const match = absences.find((absence) => absence.id === requestedAbsenceId)
    if (match) {
      setMode('existing')
      setSelectedAbsence(match)
      handleFindSubs(match).catch((error) => {
        console.error('Failed to load requested absence:', error)
      })
      hasAppliedAbsenceRef.current = true
    }
  }, [requestedAbsenceId, absences])

  useEffect(() => {
    if (manualStartDate && manualEndDate) {
      if (manualEndDate < manualStartDate) {
        setManualEndDate(manualStartDate)
        justCorrectedRef.current = true
        setEndDateCorrected(true)
        const timer = setTimeout(() => {
          setEndDateCorrected(false)
          justCorrectedRef.current = false
        }, 5000)
        return () => clearTimeout(timer)
      }

      if (manualEndDate === manualStartDate && justCorrectedRef.current) {
        return
      }
      setEndDateCorrected(false)
      justCorrectedRef.current = false
      return
    }

    setEndDateCorrected(false)
    justCorrectedRef.current = false
  }, [manualStartDate, manualEndDate])

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

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const response = await fetch('/api/teachers')
        if (!response.ok) throw new Error('Failed to fetch teachers')
        const data = await response.json()
        const sortedTeachers = (data as Teacher[])
          .filter((teacher) => teacher.active !== false)
          .sort((a, b) => {
            const nameA = (a.display_name || `${a.first_name ?? ''} ${a.last_name ?? ''}`).trim()
            const nameB = (b.display_name || `${b.first_name ?? ''} ${b.last_name ?? ''}`).trim()
            return nameA.localeCompare(nameB)
          })
        setTeachers(sortedTeachers)
      } catch (error) {
        console.error('Error fetching teachers:', error)
        setTeachers([])
      }
    }

    fetchTeachers()
  }, [])

  const fetchAbsences = async () => {
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
      console.log('Fetched absences:', data)
      setAbsences(data)
    } catch (error) {
      console.error('Error fetching absences:', error)
      // Show error to user - you might want to add a toast notification here
      setAbsences([])
    } finally {
      setLoading(false)
    }
  }

  const handleFindSubs = async (absence: Absence) => {
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
      setAllSubs(data) // Store all subs
      
      // Calculate recommended combination
      const combination = findBestCombination(data)
      setRecommendedCombination(combination)
      
      // Filter based on includeOnlyRecommended
      if (includeOnlyRecommended) {
        setRecommendedSubs(data.filter((sub: any) => sub.coverage_percent > 0))
      } else {
        setRecommendedSubs(data)
      }
    } catch (error) {
      console.error('Error finding subs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFindManualSubs = async () => {
    if (!manualTeacherId || !manualStartDate) return
    setLoading(true)
    const teacher = teachers.find((t) => t.id === manualTeacherId)
    const teacherName = (teacher?.display_name || `${teacher?.first_name ?? ''} ${teacher?.last_name ?? ''}`).trim()
    setSelectedAbsence({
      id: `manual-${manualTeacherId}`,
      teacher_id: manualTeacherId,
      teacher_name: teacherName || 'Manual Coverage',
      start_date: manualStartDate,
      end_date: manualEndDate || manualStartDate,
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
    setRecommendedCombination(null)
    setHighlightedSubId(null)
    try {
      const response = await fetch('/api/sub-finder/find-subs-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: manualTeacherId,
          start_date: manualStartDate,
          end_date: manualEndDate || manualStartDate,
          shifts: manualSelectedShifts,
        }),
      })
      if (!response.ok) throw new Error('Failed to find subs')
      const data = await response.json()
      const shiftDetails = data.shift_details || []
      const totals = data.totals || { total: shiftDetails.length, uncovered: shiftDetails.length, partially_covered: 0, fully_covered: 0 }

      setSelectedAbsence({
        id: `manual-${manualTeacherId}`,
        teacher_id: manualTeacherId,
        teacher_name: teacherName || 'Manual Coverage',
        start_date: manualStartDate,
        end_date: manualEndDate || manualStartDate,
        reason: null,
        shifts: {
          total: totals.total,
          uncovered: totals.uncovered,
          partially_covered: totals.partially_covered,
          fully_covered: totals.fully_covered,
          shift_details: shiftDetails,
        },
      })

      const subs = data.subs || []
      setAllSubs(subs)
      const combination = findBestCombination(subs)
      setRecommendedCombination(combination)
      setIncludeOnlyRecommended(true)
      if (true) {
        setRecommendedSubs(subs.filter((sub: any) => sub.coverage_percent > 0))
      } else {
        setRecommendedSubs(subs)
      }
    } catch (error) {
      console.error('Error finding subs (manual):', error)
    } finally {
      setLoading(false)
    }
  }

  // Update recommended subs when filter changes
  useEffect(() => {
    if (allSubs.length > 0 && selectedAbsence) {
      if (includeOnlyRecommended) {
        setRecommendedSubs(allSubs.filter((sub: any) => sub.coverage_percent > 0))
      } else {
        setRecommendedSubs(allSubs)
      }
      // Recalculate combination when filters change (combination is based on all subs with coverage > 0)
      const combination = findBestCombination(allSubs)
      setRecommendedCombination(combination)
    } else if (!selectedAbsence) {
      // Clear combination when no absence is selected
      setRecommendedCombination(null)
    }
  }, [includeOnlyRecommended, selectedAbsence, allSubs])

  const handleRerunFinder = async () => {
    if (selectedAbsence) {
      await handleFindSubs(selectedAbsence)
    }
  }

  // Helper to create cache key
  const getCacheKey = (subId: string, absenceId: string) => `${subId}-${absenceId}`

  // Fetch contact data for a sub/absence combination
  const fetchContactDataForSub = async (sub: any, absence: Absence) => {
    const cacheKey = getCacheKey(sub.id, absence.id)
    
    // Check cache first
    if (contactDataCache.has(cacheKey)) {
      return contactDataCache.get(cacheKey)
    }

    try {
      // Get coverage_request_id first
      const coverageResponse = await fetch(`/api/sub-finder/coverage-request/${absence.id}`)
      if (!coverageResponse.ok) {
        console.error('Failed to fetch coverage request')
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
  const invalidateContactCache = (subId: string, absenceId: string) => {
    const cacheKey = getCacheKey(subId, absenceId)
    setContactDataCache(prev => {
      const next = new Map(prev)
      next.delete(cacheKey)
      return next
    })
  }

  const handleContactSub = async (sub: any) => {
    setSelectedSub(sub)
    setIsContactPanelOpen(true)
    
    // Prefetch contact data in background if we have an absence
    if (selectedAbsence) {
      fetchContactDataForSub(sub, selectedAbsence).catch(error => {
        console.error('Error prefetching contact data:', error)
      })
    }
  }

  const handleViewDetails = async (sub: any) => {
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
    setSelectedSub(null)
  }

  // Handler for combination contact button
  const handleCombinationContact = (subId: string) => {
    const sub = allSubs.find((s: any) => s.id === subId)
    if (sub) {
      handleContactSub(sub)
    }
  }

  // Handle shift click to scroll to sub card
  const handleShiftClick = (shift: any) => {
    if (!shift.sub_name) return
    
    // Find the sub in recommendedSubs by matching assigned shifts
    const sub = recommendedSubs.find((s: any) => {
      return s.assigned_shifts?.some((as: any) => 
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

  // Filter absences based on search query
  const filteredAbsences = absences.filter(absence => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      absence.teacher_name.toLowerCase().includes(query) ||
      absence.reason?.toLowerCase().includes(query) ||
      absence.start_date.includes(query) ||
      absence.end_date?.includes(query)
    )
  })

  return (
    <div className="flex h-[calc(100vh-4rem+1.5rem+4rem)] -mx-4 -mt-[calc(1.5rem+4rem)] -mb-6 relative">
      {/* Left Rail */}
      <div className="w-80 border-r border-slate-200 bg-slate-100 shadow-[2px_0_6px_rgba(0,0,0,0.03)] flex flex-col overflow-hidden">
        <div className="sticky top-0 z-10 px-3 pt-10 pb-4 border-b border-slate-200 bg-slate-100 flex flex-col">
          <h1 className="text-xl font-bold mb-4 text-slate-800 pl-2">Sub Finder</h1>

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
                    ? "!bg-slate-800 !text-white shadow-sm"
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
                    ? "!bg-slate-800 !text-white shadow-sm"
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
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onFocus={() => setIsTeacherSearchOpen(true)}
                        onBlur={() => {
                          setTimeout(() => setIsTeacherSearchOpen(false), 150)
                        }}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                    {isTeacherSearchOpen && (
                      <div className="border-t border-slate-100 max-h-40 overflow-y-auto px-2 py-1">
                        {Array.from(new Set(absences.map((absence) => absence.teacher_name)))
                          .filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .sort((a, b) => a.localeCompare(b))
                          .map((name) => (
                            <button
                              key={name}
                              type="button"
                              className="w-full rounded px-1.5 py-1 text-left text-sm text-slate-700 hover:bg-slate-100"
                              onClick={() => {
                                setSearchQuery(name)
                                setIsTeacherSearchOpen(false)
                              }}
                            >
                              {name}
                            </button>
                          ))}
                        {absences.length === 0 && (
                          <div className="px-1.5 py-1 text-xs text-muted-foreground">
                            No teachers found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
                          const name = (teacher.display_name || `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`).trim()
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
                    onChange={setManualEndDate}
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
                  onShiftsChange={setManualSelectedShifts}
                  autoSelectScheduled
                  tableClassName="text-xs [&_th]:px-2 [&_td]:px-2"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-slate-200 text-primary hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white"
                disabled={!manualTeacherId || !manualStartDate}
                onClick={handleFindManualSubs}
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
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span>Sub Finder</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{selectedAbsence.teacher_name}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-muted-foreground font-normal">
                      {(() => {
                        const formatDate = (dateString: string) => {
                          const date = parseLocalDate(dateString)
                          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                          const month = monthNames[date.getMonth()]
                          const day = date.getDate()
                          return `${month} ${day}`
                        }
                        const startDate = formatDate(selectedAbsence.start_date)
                        if (selectedAbsence.end_date && selectedAbsence.end_date !== selectedAbsence.start_date) {
                          const endDate = formatDate(selectedAbsence.end_date)
                          return `${startDate} - ${endDate}`
                        }
                        return startDate
                      })()}
                    </span>
                  </h2>
                  {selectedClassrooms.length > 0 && (
                    <div className="text-base text-muted-foreground">
                      {selectedClassrooms.length === 1 ? 'Classroom' : 'Classrooms'}:{' '}
                      {selectedClassrooms.join(', ')}
                    </div>
                  )}
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
                      <div className="w-3 h-3 rounded border bg-blue-50 border-blue-200" />
                      <span>Assigned</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded border bg-emerald-50 border-emerald-200" />
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded border bg-gray-100 border-gray-300" />
                      <span>Unavailable</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded border bg-amber-50 border-amber-200" />
                      <span>Uncovered</span>
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
                                      const name = sub.name || sub.display_name || `${sub.first_name ?? ''} ${sub.last_name ?? ''}` || 'Unknown'
                                      const canCover = (sub.shifts_covered ?? 0) > 0 || (sub.can_cover?.length ?? 0) > 0
                                      return (
                                        <button
                                          key={sub.id}
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                                          onClick={() => {
                                            if (!canCover && includeOnlyRecommended) {
                                              setIncludeOnlyRecommended(false)
                                              setRecommendedSubs(allSubs)
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
                                onCheckedChange={setIncludeFlexibleStaff}
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
              {recommendedCombination && (
                <div className="mt-6">
                  <RecommendedCombination
                    combination={recommendedCombination}
                    onContactSub={handleCombinationContact}
                    totalShifts={selectedAbsence.shifts.total}
                    useRemainingLabel={selectedAbsence.shifts.total > selectedAbsence.shifts.uncovered}
                  />
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
