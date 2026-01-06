'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RefreshCw, Search } from 'lucide-react'
import AbsenceList from '@/components/sub-finder/AbsenceList'
import RecommendedSubsList from '@/components/sub-finder/RecommendedSubsList'

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
  const [searchQuery, setSearchQuery] = useState('')

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
      setRecommendedSubs(data)
    } catch (error) {
      console.error('Error finding subs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRerunFinder = async () => {
    if (selectedAbsence) {
      await handleFindSubs(selectedAbsence)
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
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Rail */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b bg-white">
          <h1 className="text-2xl font-bold mb-4">Sub Finder</h1>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={mode === 'existing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('existing')}
              className="flex-1"
            >
              Existing Absences
            </Button>
            <Button
              variant={mode === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('manual')}
              className="flex-1"
            >
              Manual Coverage
            </Button>
          </div>

          {/* Search/Filter (for existing absences mode) */}
          {mode === 'existing' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search absences..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 text-sm border rounded-md px-2 py-1"
                />
              </div>
            </div>
          )}

          {/* Manual Coverage Form (for manual mode) */}
          {mode === 'manual' && (
            <div className="space-y-3">
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
        {/* Search Controls Bar */}
        {selectedAbsence && (
          <div className="border-b bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button onClick={handleRerunFinder} disabled={loading} size="sm" variant="outline">
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Rerun Finder
                </Button>

                <div className="flex items-center gap-2">
                  <Switch
                    id="include-partial"
                    checked={includePartiallyCovered}
                    onCheckedChange={setIncludePartiallyCovered}
                  />
                  <Label htmlFor="include-partial" className="text-sm font-normal cursor-pointer">
                    Include partially covered shifts
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="include-flexible"
                    checked={includeFlexibleStaff}
                    onCheckedChange={setIncludeFlexibleStaff}
                  />
                  <Label htmlFor="include-flexible" className="text-sm font-normal cursor-pointer">
                    Include Flexible Staff
                  </Label>
                </div>
              </div>

              {selectedAbsence && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{selectedAbsence.teacher_name}</span>
                  {' - '}
                  {new Date(selectedAbsence.start_date).toLocaleDateString()}
                  {selectedAbsence.end_date &&
                    ` to ${new Date(selectedAbsence.end_date).toLocaleDateString()}`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommended Subs List */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedAbsence ? (
            <RecommendedSubsList
              subs={recommendedSubs}
              loading={loading}
              absence={selectedAbsence}
            />
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
    </div>
  )
}
