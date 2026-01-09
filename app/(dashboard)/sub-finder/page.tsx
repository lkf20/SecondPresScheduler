'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RefreshCw, Search, Settings2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import AbsenceList from '@/components/sub-finder/AbsenceList'
import RecommendedSubsList from '@/components/sub-finder/RecommendedSubsList'
import RecommendedCombination from '@/components/sub-finder/RecommendedCombination'
import ContactSubPanel from '@/components/sub-finder/ContactSubPanel'
import { parseLocalDate } from '@/lib/utils/date'
import { findBestCombination } from '@/lib/utils/sub-combination'
import { cn } from '@/lib/utils'

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
    }>
  }
}

export default function SubFinderPage() {
  const [mode, setMode] = useState<Mode>('existing')
  const [absences, setAbsences] = useState<Absence[]>([])
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null)
  const [recommendedSubs, setRecommendedSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [includePartiallyCovered, setIncludePartiallyCovered] = useState(false)
  const [includeFlexibleStaff, setIncludeFlexibleStaff] = useState(true)
  const [includeOnlyRecommended, setIncludeOnlyRecommended] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [allSubs, setAllSubs] = useState<any[]>([]) // Store all subs from API
  const [selectedSub, setSelectedSub] = useState<any | null>(null)
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false)
  // Cache contact data: key = `${subId}-${absenceId}`
  const [contactDataCache, setContactDataCache] = useState<Map<string, any>>(new Map())
  const [recommendedCombination, setRecommendedCombination] = useState<any>(null)

  // Fetch absences on mount and when filters change
  useEffect(() => {
    if (mode === 'existing') {
      fetchAbsences()
    }
  }, [mode, includePartiallyCovered])

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
      <div className="w-80 border-r border-slate-200 bg-slate-50 shadow-[2px_0_6px_rgba(0,0,0,0.03)] flex flex-col overflow-hidden">
        <div className="sticky top-0 z-10 px-3 pt-4 pb-4 border-b border-slate-200 bg-slate-50 flex flex-col">
          <h1 className="text-xl font-bold mb-4 text-slate-900">Sub Finder</h1>

          {/* Mode Toggle - Softer Selected State */}
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode('existing')}
              className={cn(
                "flex-1 transition-all",
                mode === 'existing' 
                  ? "bg-slate-200 text-slate-900 border-slate-400 shadow-sm font-semibold" 
                  : "bg-white/50 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              Existing Absences
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode('manual')}
              className={cn(
                "flex-1 transition-all",
                mode === 'manual' 
                  ? "bg-slate-200 text-slate-900 border-slate-400 shadow-sm font-semibold" 
                  : "bg-white/50 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              Manual Coverage
            </Button>
          </div>

          {/* Search/Filter (for existing absences mode) */}
          {mode === 'existing' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search absences..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 text-sm border border-slate-200 rounded-md px-2 py-1 bg-white/80 focus:bg-white focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Manual Coverage Form (for manual mode) */}
          {mode === 'manual' && (
            <div className="space-y-2">
              <div>
                <Label className="text-sm">Teacher</Label>
                <select className="w-full mt-1 text-sm border rounded-md px-2 py-1.5">
                  <option>Select teacher...</option>
                </select>
              </div>
              <div>
                <Label className="text-sm">Start Date</Label>
                <input type="date" className="w-full mt-1 text-sm border rounded-md px-2 py-1.5" />
              </div>
              <div>
                <Label className="text-sm">End Date</Label>
                <input type="date" className="w-full mt-1 text-sm border rounded-md px-2 py-1.5" />
              </div>
              <Button size="sm" className="w-full">
                Load Scheduled Shifts
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header Bar */}
        {selectedAbsence && (
          <div className="sticky top-0 z-10 border-b bg-white">
            <div className="px-6 pt-4 pb-4">
              {/* Header Row */}
              <div className="mb-3">
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
                <p className="text-xs text-muted-foreground mt-0.5">
                  {includeOnlyRecommended
                    ? 'Sorted by coverage percentage (highest first)'
                    : 'Showing all subs with coverage details'}
                </p>
              </div>

              {/* Toolbar Row */}
              <div className="flex items-end justify-between">
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
                      Filters
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
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-4">
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
        )}

        {/* Recommended Combination and Subs List - now scrollable without header */}
        <div className="flex-1 overflow-y-auto">
          {selectedAbsence ? (
            <div className="p-4">
              {/* Recommended Combination Section */}
              {recommendedCombination && (
                <RecommendedCombination
                  combination={recommendedCombination}
                  onContactSub={handleCombinationContact}
                />
              )}
              
              <RecommendedSubsList
                subs={recommendedSubs}
                loading={loading}
                absence={selectedAbsence}
                showAllSubs={!includeOnlyRecommended}
                onContactSub={handleContactSub}
                onViewDetails={handleViewDetails}
                hideHeader
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
            // Invalidate cache for this sub/absence combination
            if (selectedSub && selectedAbsence) {
              invalidateContactCache(selectedSub.id, selectedAbsence.id)
            }
            
            // Refresh absences to update coverage status
            await fetchAbsences()
            // Refresh recommended subs if we have a selected absence
            // This will also recalculate the combination
            if (selectedAbsence) {
              await handleFindSubs(selectedAbsence)
            }
          }}
        />
      )}
    </div>
  )
}
