'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Phone, Mail, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'
import ShiftChips, { formatShiftLabel } from '@/components/sub-finder/ShiftChips'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getShiftStatusColorClasses, getButtonColors, getPanelBackgroundClasses, getPanelHeaderBackgroundClasses, panelBackgrounds } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ResponseStatus = 'none' | 'pending' | 'confirmed' | 'declined_all'

type ShiftOverride = {
  coverage_request_shift_id?: string | null
  selected: boolean
  override_availability: boolean
  shift?: {
    date: string
    time_slot?: {
      code?: string | null
    } | null
  } | null
}

interface RecommendedSub {
  id: string
  name: string
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
    diaper_changing_required?: boolean
    lifting_children_required?: boolean
  }>
  cannot_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    reason: string
    coverage_request_shift_id?: string
  }>
  assigned_shifts?: Array<{
    date: string
    day_name: string
    time_slot_code: string
  }>
  remaining_shift_keys?: string[]
  remaining_shift_count?: number
  has_assigned_shifts?: boolean
  can_change_diapers?: boolean
  can_lift_children?: boolean
}

interface Absence {
  id: string
  teacher_name: string
  start_date: string
  end_date: string | null
}

interface ContactData {
  id: string
  is_contacted: boolean
  contacted_at: string | null
  response_status: ResponseStatus
  notes: string | null
  shift_overrides?: ShiftOverride[]
  coverage_request_id?: string
  shift_map?: Record<string, string>
  selected_shift_keys?: string[]
  override_shift_keys?: string[]
}

interface ContactSubPanelProps {
  isOpen: boolean
  onClose: () => void
  sub: RecommendedSub | null
  absence: Absence | null
  initialContactData?: ContactData // Cached contact data from parent
  onAssignmentComplete?: () => void // Callback to refresh data after assignment
}

export default function ContactSubPanel({
  isOpen,
  onClose,
  sub,
  absence,
  initialContactData,
  onAssignmentComplete,
}: ContactSubPanelProps) {
  const [isContacted, setIsContacted] = useState(false)
  const [contactedAt, setContactedAt] = useState<string | null>(null)
  const [responseStatus, setResponseStatus] = useState<'none' | 'pending' | 'confirmed' | 'declined_all'>('none')
  const [notes, setNotes] = useState('')
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set())
  const [assignedShifts, setAssignedShifts] = useState<Array<{
    coverage_request_shift_id: string
    date: string
    day_name: string
    time_slot_code: string
  }>>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [coverageRequestId, setCoverageRequestId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(null)
  const [overriddenShiftIds, setOverriddenShiftIds] = useState<Set<string>>(new Set())
  const [isSubInactive, setIsSubInactive] = useState(false)
  const [isPreviouslyAvailableExpanded, setIsPreviouslyAvailableExpanded] = useState(false)
  const [remainingShiftKeys, setRemainingShiftKeys] = useState<Set<string>>(new Set())
  const [remainingShiftCount, setRemainingShiftCount] = useState<number | null>(null)

  const applyShiftSelections = (data: ContactData) => {
    if (data.response_status === 'declined_all') {
      setSelectedShifts(new Set())
      setOverriddenShiftIds(new Set())
      return
    }

    if (Array.isArray(data.selected_shift_keys) || Array.isArray(data.override_shift_keys)) {
      setSelectedShifts(new Set(data.selected_shift_keys || []))
      setOverriddenShiftIds(new Set(data.override_shift_keys || []))
      return
    }

    if (data.shift_overrides && data.shift_overrides.length > 0) {
      const selected = new Set<string>()
      const overridden = new Set<string>()
      data.shift_overrides.forEach((override: ShiftOverride) => {
        if (!override.shift) return
        const key = `${override.shift.date}|${override.shift.time_slot?.code || ''}`
        if (override.selected) {
          selected.add(key)
        }
        if (override.override_availability) {
          overridden.add(key)
        }
      })
      setSelectedShifts(selected)
      setOverriddenShiftIds(overridden)
    }
  }

  // Initialize assignedShifts and selectedShifts immediately from sub prop (no API call needed)
  useEffect(() => {
    if (sub?.assigned_shifts) {
      setAssignedShifts(sub.assigned_shifts)
    }
  }, [sub?.assigned_shifts])

  // Initialize selectedShifts to all can_cover shifts immediately when sub changes
  // But don't select if response_status is declined_all
  useEffect(() => {
    if (sub?.can_cover) {
      // If responseStatus is already 'declined_all', don't select any shifts
      if (responseStatus === 'declined_all') {
        setSelectedShifts(new Set())
        return
      }
      const shiftKeys = sub.can_cover.map(
        (shift) => `${shift.date}|${shift.time_slot_code}`
      )
      setSelectedShifts(new Set(shiftKeys))
    }
  }, [sub?.can_cover, responseStatus])

  // Clear all shifts when responseStatus changes to 'declined_all'
  useEffect(() => {
    if (responseStatus === 'declined_all') {
      setSelectedShifts(new Set())
      setOverriddenShiftIds(new Set())
    }
  }, [responseStatus])

  // Use cached contact data if available, otherwise fetch
  // Coverage Summary and Shift Assignments can display immediately using sub prop
  useEffect(() => {
    if (!isOpen || !sub || !absence) return

    // If we have cached data, use it immediately
    if (initialContactData) {
      setContactId(initialContactData.id)
      setIsContacted(initialContactData.is_contacted ?? false)
      setContactedAt(initialContactData.contacted_at)
      setResponseStatus(initialContactData.response_status || 'none')
      setNotes(initialContactData.notes || '')
      setCoverageRequestId(initialContactData.coverage_request_id || null)

      applyShiftSelections(initialContactData)
      // If no shift_overrides, keep the initial selection from can_cover (unless declined_all)

      // Still check if sub is inactive (this is quick and doesn't block UI)
      fetch(`/api/subs/${sub.id}`)
        .then(res => res.ok ? res.json() : null)
        .then(subData => {
          if (subData) {
            setIsSubInactive(!subData.active)
          }
        })
        .catch(() => {
          // Ignore errors for inactive check
        })

      setFetching(false)
      return
    }

    if (absence.id.startsWith('manual-')) {
      setCoverageRequestId(null)
      setFetching(false)
      return
    }

    // No cached data - fetch it
    const fetchContactData = async () => {
      setFetching(true)
      try {
        // Fetch coverage_request_id and shift map in parallel with contact data
        const [coverageResponse, subResponse] = await Promise.all([
          fetch(`/api/sub-finder/coverage-request/${absence.id}`),
          fetch(`/api/subs/${sub.id}`).catch(() => null), // Optional: check if sub is inactive
        ])

        if (!coverageResponse.ok) {
          const errorBody = await coverageResponse.text().catch(() => '')
          console.error(
            `Failed to fetch coverage request: status=${coverageResponse.status} statusText=${coverageResponse.statusText} url=${coverageResponse.url} body=${errorBody.slice(0, 200)}`
          )
          setFetching(false)
          return
        }
        const coverageData = await coverageResponse.json()
        setCoverageRequestId(coverageData.coverage_request_id)

        // Check if sub is inactive
        if (subResponse?.ok) {
          const subData = await subResponse.json()
          setIsSubInactive(!subData.active)
        }

        // Get or create substitute contact
        const contactResponse = await fetch(
          `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageData.coverage_request_id}&sub_id=${sub.id}`
        )
        if (contactResponse.ok) {
          const contactData = await contactResponse.json()
          if (contactData) {
            setContactId(contactData.id)
            setIsContacted(contactData.is_contacted ?? false)
            setContactedAt(contactData.contacted_at)
            setResponseStatus(contactData.response_status || 'none')
            setNotes(contactData.notes || '')

            applyShiftSelections(contactData)
            // If no shift_overrides, keep the initial selection from can_cover (unless declined_all)
          }
        }
      } catch (error) {
        console.error('Error fetching contact data:', error)
      } finally {
        setFetching(false)
      }
    }

    fetchContactData()
  }, [isOpen, sub, absence, initialContactData])

  // Fetch remaining shifts for the coverage request (computed server-side)
  useEffect(() => {
    if (!coverageRequestId || !absence) {
      setRemainingShiftKeys(new Set())
      setRemainingShiftCount(null)
      return
    }

    const fetchRemainingShifts = async () => {
      try {
        const response = await fetch(`/api/sub-finder/coverage-request/${absence.id}/assigned-shifts`)
        if (response.ok) {
          const data = await response.json()
          const remainingKeys = new Set<string>(
            Array.isArray(data.remaining_shift_keys) ? data.remaining_shift_keys : []
          )
          setRemainingShiftKeys(remainingKeys)
          setRemainingShiftCount(typeof data.remaining_shift_count === 'number' ? data.remaining_shift_count : null)
        } else {
          console.error('Failed to fetch assigned shifts:', response.status, response.statusText)
          const errorText = await response.text()
          console.error('Error response:', errorText)
        }
      } catch (error) {
        console.error('Error fetching remaining shifts:', error)
      }
    }

    fetchRemainingShifts()
  }, [coverageRequestId, absence])

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setIsContacted(false)
      setContactedAt(null)
      setResponseStatus('none')
      setNotes('')
      setSelectedShifts(new Set())
      setAssignedShifts([])
      setCoverageRequestId(null)
      setContactId(null)
      setOverriddenShiftIds(new Set())
      setIsSubInactive(false)
      setIsPreviouslyAvailableExpanded(false)
      setRemainingShiftKeys(new Set())
      setRemainingShiftCount(null)
    }
  }, [isOpen])

  // Reset collapsed state when response status changes from declined_all
  useEffect(() => {
    if (responseStatus !== 'declined_all') {
      setIsPreviouslyAvailableExpanded(false)
    }
  }, [responseStatus])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dayName = dayNames[date.getDay()]
    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    return `${dayName} ${month} ${day}`
  }


  // Format date range for display
  const formatDateRange = () => {
    if (!absence) return null
    
    const startDate = formatDate(absence.start_date)
    
    if (!absence.end_date || absence.end_date === absence.start_date) {
      return startDate
    }
    
    const endDate = formatDate(absence.end_date)
    return `${startDate} - ${endDate}`
  }

  // Format contacted timestamp
  const formatContactedTimestamp = (timestamp: string | null) => {
    if (!timestamp) return null

    const contactedDate = new Date(timestamp)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const contactedDay = new Date(contactedDate.getFullYear(), contactedDate.getMonth(), contactedDate.getDate())

    // Format time
    const hours = contactedDate.getHours()
    const minutes = contactedDate.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    const timeStr = `${displayHours}:${displayMinutes} ${ampm}`

    if (contactedDay.getTime() === today.getTime()) {
      return `Today at ${timeStr}`
    } else if (contactedDay.getTime() === yesterday.getTime()) {
      return `Yesterday at ${timeStr}`
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = monthNames[contactedDate.getMonth()]
      const day = contactedDate.getDate()
      const year = contactedDate.getFullYear()
      const currentYear = now.getFullYear()
      
      if (year === currentYear) {
        return `${month} ${day} at ${timeStr}`
      } else {
        return `${month} ${day}, ${year} at ${timeStr}`
      }
    }
  }

  // Don't render if no sub or absence, but Sheet must still have a title when open
  if (!sub || !absence) {
    if (!isOpen) return null
    // If panel is open but no data, show empty state with proper title
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className={`w-full sm:max-w-2xl overflow-y-auto p-0 [&>button]:hidden ${getPanelBackgroundClasses()}`}>
          <div className={`sticky top-0 z-10 ${getPanelHeaderBackgroundClasses()} ${panelBackgrounds.panelBorder} border-b px-6 pt-6 pb-4 relative`}>
            <SheetClose asChild>
              <button
                type="button"
                className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-white"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </SheetClose>
            <SheetHeader>
              <SheetTitle>Contact Sub</SheetTitle>
            </SheetHeader>
          </div>
          <div className="px-6">
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p>No sub selected</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }


  const handleShiftToggle = (shiftKey: string, isAvailable: boolean) => {
    // Only allow selection if available OR overridden
    if (!isAvailable && !overriddenShiftIds.has(shiftKey)) {
      return // Can't select unavailable shifts without override
    }
    
    const newSelected = new Set(selectedShifts)
    if (newSelected.has(shiftKey)) {
      newSelected.delete(shiftKey)
    } else {
      newSelected.add(shiftKey)
    }
    setSelectedShifts(newSelected)
  }

  const handleToggleOverride = (shiftKey: string) => {
    setOverriddenShiftIds((prev) => {
      const next = new Set(prev)
      if (next.has(shiftKey)) {
        next.delete(shiftKey)
      } else {
        next.add(shiftKey)
      }
      return next
    })
  }

  const resolveShiftOverrides = async () => {
    if (!coverageRequestId || !sub) {
      throw new Error('Coverage request or sub data missing')
    }

    const availableShiftKeys = (sub.can_cover || []).map(
      (shift) => `${shift.date}|${shift.time_slot_code}`
    )
    const unavailableShiftKeys = (sub.cannot_cover || []).map(
      (shift) => `${shift.date}|${shift.time_slot_code}`
    )

    const response = await fetch('/api/sub-finder/shift-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coverage_request_id: coverageRequestId,
        selected_shift_keys: Array.from(selectedShifts),
        override_shift_keys: Array.from(overriddenShiftIds),
        available_shift_keys: availableShiftKeys,
        unavailable_shift_keys: unavailableShiftKeys,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        errorBody || `Failed to resolve shift overrides (${response.status} ${response.statusText})`
      )
    }

    return (await response.json()) as {
      shift_overrides: Array<{
        coverage_request_shift_id: string
        selected: boolean
        override_availability: boolean
      }>
      selected_shift_ids: string[]
    }
  }

  const handleSave = async () => {
    if (!coverageRequestId) {
      console.error('Coverage request ID not available')
      return
    }

    setLoading(true)
    try {
      const resolvedOverrides = await resolveShiftOverrides()

      // Get or create contact first if we don't have contactId
      let currentContactId = contactId
      if (!currentContactId) {
        const getContactResponse = await fetch(
          `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageRequestId}&sub_id=${sub.id}`
        )
        if (getContactResponse.ok) {
          const contactData = await getContactResponse.json()
          currentContactId = contactData.id
          setContactId(currentContactId)
        } else {
          throw new Error('Failed to get or create contact')
        }
      }

      // Update contact with response_status, is_contacted, notes, and shift overrides
      const updateResponse = await fetch('/api/sub-finder/substitute-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentContactId,
          response_status: responseStatus,
          is_contacted: isContacted,
          notes: notes || null,
          shift_overrides: resolvedOverrides.shift_overrides,
          selected_shift_keys: Array.from(selectedShifts),
        }),
      })

      const updatedContactData = await updateResponse.json()
      
      if (!updateResponse.ok) {
        throw new Error(updatedContactData.error || 'Failed to save contact')
      }

      // Refresh contact data to get updated contacted_at if it was set
      if (updatedContactData) {
        setIsContacted(updatedContactData.is_contacted ?? false)
        if (updatedContactData.contacted_at) {
          setContactedAt(updatedContactData.contacted_at)
        }
        setResponseStatus(updatedContactData.response_status || 'none')
      }

      // Refresh parent data to update the main page
      if (onAssignmentComplete) {
        onAssignmentComplete()
      }

      onClose()
    } catch (error) {
      console.error('Error saving contact:', error)
      alert(`Error saving contact: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Calculate contextual warnings
  const calculateWarnings = () => {
    if (!sub || !sub.can_cover) return []
    
    const warnings: string[] = []
    const selectedShiftKeys = Array.from(selectedShifts)
    
    // Check each selected shift for requirements
    const hasDiaperingRequired = sub.can_cover.some((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      return selectedShiftKeys.includes(shiftKey) && shift.diaper_changing_required
    })
    
    const hasLiftingRequired = sub.can_cover.some((shift) => {
      const shiftKey = `${shift.date}|${shift.time_slot_code}`
      return selectedShiftKeys.includes(shiftKey) && shift.lifting_children_required
    })
    
    if (hasDiaperingRequired && !sub.can_change_diapers) {
      warnings.push('Diapering required')
    }
    
    if (hasLiftingRequired && !sub.can_lift_children) {
      warnings.push('Lifting children required')
    }
    
    if (hasLiftingRequired && sub.can_lift_children === false) {
      warnings.push('Sub prefers not to lift children')
    }
    
    return warnings
  }

  const warnings = calculateWarnings()

  const handleAssignShifts = async () => {
    if (!coverageRequestId || selectedShifts.size === 0) {
      console.error('Cannot assign: missing coverage request or no shifts selected')
      return
    }

    setLoading(true)
    try {
      // First, save the contact with status and notes
      let currentContactId = contactId
      if (!currentContactId) {
        const getContactResponse = await fetch(
          `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageRequestId}&sub_id=${sub.id}`
        )
        if (getContactResponse.ok) {
          const contactData = await getContactResponse.json()
          currentContactId = contactData.id
          setContactId(currentContactId)
        } else {
          throw new Error('Failed to get or create contact')
        }
      }

      const resolvedOverrides = await resolveShiftOverrides()
      const selectedShiftIds = resolvedOverrides.selected_shift_ids

      if (!selectedShiftIds || selectedShiftIds.length === 0) {
        throw new Error('No valid shifts selected for assignment')
      }

      const updatePayload = {
        id: currentContactId,
        response_status: responseStatus,
        is_contacted: isContacted,
        notes: notes || null,
        shift_overrides: resolvedOverrides.shift_overrides,
        selected_shift_keys: Array.from(selectedShifts),
      }

      const updateResponse = await fetch('/api/sub-finder/substitute-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        let errorData: Record<string, unknown> = {}
        let errorMessage = `Failed to update contact (${updateResponse.status} ${updateResponse.statusText})`
        
        try {
          if (errorText) {
            errorData = JSON.parse(errorText)
            errorMessage = errorData.error || errorData.message || errorMessage
          }
        } catch {
          // If JSON parsing fails, use the raw text
          errorMessage = errorText || errorMessage
          errorData = { rawError: errorText }
        }
        
        console.error('Update contact error:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          errorText: errorText || '(empty response)',
          errorData,
          payload: updatePayload,
        })
        
        throw new Error(errorMessage)
      }

      // Create calendar entries (sub_assignments)
      const assignPayload = {
        coverage_request_id: coverageRequestId,
        sub_id: sub.id,
        selected_shift_ids: selectedShiftIds,
      }

      if (!coverageRequestId) {
        throw new Error('Coverage request ID is missing. Please try opening the panel again.')
      }

      const assignResponse = await fetch('/api/sub-finder/assign-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignPayload),
      })

      if (!assignResponse.ok) {
        const errorText = await assignResponse.text()
        let errorData: Record<string, unknown> = {}
        let errorMessage = `Failed to assign shifts (${assignResponse.status} ${assignResponse.statusText})`
        
        try {
          if (errorText) {
            errorData = JSON.parse(errorText)
            errorMessage = errorData.error || errorData.message || errorMessage
          }
        } catch {
          errorMessage = errorText || errorMessage
          errorData = { rawError: errorText }
        }
        
        console.error('Assign shifts error:', {
          status: assignResponse.status,
          statusText: assignResponse.statusText,
          errorText,
          errorData,
          payload: assignPayload,
        })
        
        throw new Error(errorMessage)
      }

      // Update assigned shifts state with response data
      const assignData = await assignResponse.json()
      if (assignData.assigned_shifts) {
        setAssignedShifts(assignData.assigned_shifts)
      }

      // Show success toast
      const shiftCount = selectedShiftIds.length
      const teacherName = absence?.teacher_name || 'teacher'
      toast.success(
        `Assigned ${shiftCount} shift${shiftCount !== 1 ? 's' : ''} to ${sub.name} for ${teacherName}`,
        {
          description: `Coverage has been scheduled and updated in the calendar.`,
        }
      )

      // Refresh parent data (absences and recommended subs)
      if (onAssignmentComplete) {
        onAssignmentComplete()
      }

      // Refresh remaining shifts to update remaining shifts calculation
      if (coverageRequestId && absence) {
        const refreshResponse = await fetch(`/api/sub-finder/coverage-request/${absence.id}/assigned-shifts`)
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          const refreshedRemainingKeys = new Set<string>(
            Array.isArray(refreshData.remaining_shift_keys) ? refreshData.remaining_shift_keys : []
          )
          setRemainingShiftKeys(refreshedRemainingKeys)
          setRemainingShiftCount(
            typeof refreshData.remaining_shift_count === 'number' ? refreshData.remaining_shift_count : null
          )
        }
      }

      // Don't close - keep panel open so user can see the updated status
    } catch (error) {
      console.error('Error assigning shifts:', error)
      alert(`Error assigning shifts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsDeclined = () => {
    // Uncheck all shifts (available, unassigned, and unavailable)
    setSelectedShifts(new Set())
    setOverriddenShiftIds(new Set())
    // Status remains 'declined_all', buttons will revert to default
    toast.success('Marked as Declined', {
      description: 'All selected shifts have been cleared.',
    })
  }

  const handleChangeToConfirmed = () => {
    // Change response status to confirmed
    setResponseStatus('confirmed')
    // Selected shifts remain selected, buttons will revert to default for confirmed
  }

  const handleMarkAsDeclinedSave = async () => {
    // When declined_all is selected with no shifts, save the contact but keep panel open
    if (responseStatus === 'declined_all' && selectedShiftsCount === 0) {
      if (!coverageRequestId) {
        console.error('Coverage request ID not available')
        return
      }

      setLoading(true)
      try {
        // Build empty shift overrides array
        const shiftOverrides: ShiftOverride[] = []

        // Get or create contact first if we don't have contactId
        let currentContactId = contactId
        if (!currentContactId) {
          const getContactResponse = await fetch(
            `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageRequestId}&sub_id=${sub.id}`
          )
          if (getContactResponse.ok) {
            const contactData = await getContactResponse.json()
            currentContactId = contactData.id
            setContactId(currentContactId)
          } else {
            throw new Error('Failed to get or create contact')
          }
        }

        // Update contact with declined status and empty shift overrides
        const updateResponse = await fetch('/api/sub-finder/substitute-contacts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentContactId,
            response_status: 'declined_all',
            is_contacted: isContacted,
            notes: notes || null,
            shift_overrides: shiftOverrides,
            selected_shift_keys: [],
          }),
        })

        const updatedContactData = await updateResponse.json()
        
        if (!updateResponse.ok) {
          throw new Error(updatedContactData.error || 'Failed to save contact')
        }

        // Refresh contact data
        if (updatedContactData) {
          setIsContacted(updatedContactData.is_contacted ?? false)
          if (updatedContactData.contacted_at) {
            setContactedAt(updatedContactData.contacted_at)
          }
          setResponseStatus(updatedContactData.response_status || 'none')
        }

        // Refresh parent data
        if (onAssignmentComplete) {
          onAssignmentComplete()
        }

        // Show success toast
        toast.success('Marked as Declined', {
          description: `${sub.name} has been marked as declined for all shifts.`,
        })

        // Close the panel after marking as declined
        onClose()
      } catch (error) {
        console.error('Error saving declined status:', error)
        alert(`Error saving declined status: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setLoading(false)
      }
    } else {
      // Otherwise, assign shifts (which will handle the declined status)
      await handleAssignShifts()
    }
  }

  const selectedShiftsCount = selectedShifts.size

  const derivedShiftKeys = (() => {
    if (remainingShiftKeys.size > 0) return remainingShiftKeys
    if (Array.isArray(sub.remaining_shift_keys) && sub.remaining_shift_keys.length > 0) {
      return new Set(sub.remaining_shift_keys)
    }
    const allKeys = new Set<string>()
    sub.can_cover?.forEach((shift) => {
      allKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    sub.cannot_cover?.forEach((shift) => {
      allKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    sub.assigned_shifts?.forEach((shift) => {
      allKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    const assignedKeys = new Set<string>()
    sub.assigned_shifts?.forEach((shift) => {
      assignedKeys.add(`${shift.date}|${shift.time_slot_code}`)
    })
    return new Set(Array.from(allKeys).filter((key) => !assignedKeys.has(key)))
  })()

  const remainingCanCover = sub.can_cover?.filter((shift) => {
    const shiftKey = `${shift.date}|${shift.time_slot_code}`
    return derivedShiftKeys.has(shiftKey)
  }) || []

  const remainingShifts =
    remainingShiftCount !== null
      ? remainingShiftCount
      : typeof sub.remaining_shift_count === 'number'
        ? sub.remaining_shift_count
        : sub.total_shifts

  const remainingShiftsCovered = remainingCanCover.length

  // Check if declined_all is selected and any shifts are selected
  const isDeclinedWithShiftsSelected = responseStatus === 'declined_all' && selectedShiftsCount > 0

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className={`w-full sm:max-w-2xl overflow-y-auto p-0 [&>button]:hidden ${getPanelBackgroundClasses()}`}>
        <div className={`sticky top-0 z-10 ${getPanelHeaderBackgroundClasses()} ${panelBackgrounds.panelBorder} border-b px-6 pt-6 pb-4 relative`}>
          <SheetClose asChild>
            <button
              type="button"
              className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-white"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </SheetClose>
          <SheetHeader className="text-left">
            <SheetTitle className="text-2xl mb-1">{sub.name}</SheetTitle>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {sub.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{sub.phone}</span>
                </span>
              )}
              {sub.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{sub.email}</span>
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {formatDateRange() && (
                <>
                  {formatDateRange()} |{' '}
                </>
              )}
              {responseStatus === 'declined_all' ? (
                'Declined all shifts'
              ) : (
                `Available for ${remainingShiftsCovered} of ${remainingShifts} remaining shifts`
              )}
            </p>
          </SheetHeader>
        </div>

        <div className="px-6">
          <div className="mt-6 space-y-10">
            {/* Declined Message */}
            {responseStatus === 'declined_all' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800">
                  This sub has declined all shifts. Change response status to enable assignment.
                </p>
              </div>
            )}
            
            {/* Coverage Summary */}
            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Coverage Summary</h3>
                <span className="text-sm text-muted-foreground">
                  {responseStatus === 'declined_all' ? (
                    'Declined all shifts'
                  ) : (
                    `${remainingShiftsCovered} of ${remainingShifts} shifts`
                  )}
                </span>
              </div>
              {(remainingCanCover.length > 0) || assignedShifts.length > 0 ? (
                <TooltipProvider>
                  <ShiftChips
                    canCover={remainingCanCover}
                    cannotCover={[]}
                    assigned={[]}
                    showLegend={true}
                    isDeclined={responseStatus === 'declined_all'}
                  />
                </TooltipProvider>
              ) : (
                <p className="text-sm text-muted-foreground">No shifts available</p>
              )}
              {/* Status */}
              <div className="space-y-2 border-t pt-[5px]">
                <Label className="text-sm font-medium mb-2 block pt-2">Status</Label>
                {assignedShifts.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Assigned to {assignedShifts.length} shift{assignedShifts.length !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not Assigned</p>
                )}
              </div>
            </div>

            {/* Contextual Warnings */}
            {warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Important Information</span>
                </div>
                {warnings.map((warning, idx) => (
                  <p key={idx} className="text-sm text-amber-700">
                    • {warning}
                  </p>
                ))}
              </div>
            )}

            {/* Contact Summary & Notes */}
            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-6">
              <h3 className="text-sm font-medium mb-4">Contact Summary</h3>
              {fetching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading contact information...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {/* Contacted Checkbox */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_contacted"
                          checked={isContacted}
                          onCheckedChange={(checked) => {
                            setIsContacted(checked === true)
                            // Set contacted_at immediately if checking and it's null
                            if (checked === true && !contactedAt) {
                              setContactedAt(new Date().toISOString())
                            }
                          }}
                        />
                        <Label htmlFor="is_contacted" className="text-sm font-medium cursor-pointer">
                          Contacted
                        </Label>
                      </div>
                      {isContacted && contactedAt && (
                        <p className="text-xs text-muted-foreground ml-6">
                          Contact status updated {formatContactedTimestamp(contactedAt)}
                        </p>
                      )}
                    </div>

                    {/* Response Status */}
                    <div className="space-y-2 border-t pt-[5px] mt-[30px]">
                      <Label className="text-sm font-medium mb-3 block pt-2">Response</Label>
                      <RadioGroup 
                        value={responseStatus} 
                        onValueChange={(value: ResponseStatus) => {
                          setResponseStatus(value)
                          // If "Declined All" is selected, uncheck all shifts
                          if (value === 'declined_all') {
                            setSelectedShifts(new Set())
                            // Also clear any overridden shifts
                            setOverriddenShiftIds(new Set())
                          }
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="none" id="response_none" />
                            <Label htmlFor="response_none" className="font-normal cursor-pointer">
                              No response yet
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="pending" id="response_pending" />
                            <Label htmlFor="response_pending" className="font-normal cursor-pointer">
                              Pending
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="confirmed" id="response_confirmed" />
                            <Label htmlFor="response_confirmed" className="font-normal cursor-pointer">
                              Confirmed (some or all)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="declined_all" id="response_declined_all" />
                            <Label htmlFor="response_declined_all" className="font-normal cursor-pointer">
                              Declined all
                            </Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                  </div>

                  <div className="space-y-2 border-t pt-6">
                    <Label htmlFor="notes" className="text-sm font-medium mb-2 block">
                      Notes
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Left voicemail… can do mornings only… prefers Orange room…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Shift Assignments - Combined Section */}
            {(assignedShifts.length > 0 || (sub.can_cover && sub.can_cover.length > 0) || (sub.cannot_cover && sub.cannot_cover.length > 0)) && (
              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-6">
                <h3 className="text-sm font-medium">Shift Assignments</h3>

                {/* Shifts Assigned to This Sub */}
                {assignedShifts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium block">
                      Assigned to this sub
                    </Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-gray-50">
                      {assignedShifts.map((shift, idx) => {
                        return (
                          <div
                            key={idx}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md bg-white"
                          >
                            <Checkbox
                              id={`assigned-shift-${idx}`}
                              checked={true}
                              disabled={true}
                            />
                            <Label
                              htmlFor={`assigned-shift-${idx}`}
                              className="flex-1 cursor-pointer font-normal"
                            >
                              <Badge
                                variant="outline"
                                className={cn('text-xs', getShiftStatusColorClasses('assigned'))}
                              >
                                {formatShiftLabel(shift.date, shift.time_slot_code)}
                              </Badge>
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Available & Not Assigned */}
                {remainingCanCover.length > 0 && (() => {
                  // Use the already filtered remaining shifts
                  const availableShifts = remainingCanCover
                  
                  if (availableShifts.length === 0) return null
                  
                  const isDeclined = responseStatus === 'declined_all'
                  
                  return (
                    <>
                      {assignedShifts.length > 0 && <div className="border-t pt-4" />}
                      <div className="space-y-2">
                        {isDeclined ? (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => setIsPreviouslyAvailableExpanded(!isPreviouslyAvailableExpanded)}
                              className="w-full flex items-center justify-between p-2 h-auto hover:bg-gray-100"
                            >
                              <div className="flex flex-col items-start">
                                <Label className="text-sm font-medium block">
                                  Previously available ({availableShifts.length})
                                </Label>
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  (assignment disabled while declined)
                                </span>
                              </div>
                              {isPreviouslyAvailableExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            {isPreviouslyAvailableExpanded && (
                              <div className="space-y-2 border rounded-md p-3 bg-gray-50">
                                <p className="text-xs text-muted-foreground mb-2">
                                  Change response to re-enable these shifts
                                </p>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {availableShifts.map((shift, idx) => {
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center space-x-2 p-2 rounded-md bg-white opacity-60"
                                      >
                                        <Checkbox
                                          id={`shift-${idx}`}
                                          checked={false}
                                          disabled={true}
                                        />
                                        <Label
                                          htmlFor={`shift-${idx}`}
                                          className="flex-1 font-normal cursor-not-allowed"
                                        >
                                          <Badge
                                            variant="outline"
                                            className="text-xs bg-gray-100 text-gray-600 border-gray-300"
                                          >
                                            {formatShiftLabel(shift.date, shift.time_slot_code)}
                                          </Badge>
                                          {shift.class_name && (
                                            <Badge variant="outline" className="text-xs ml-2 bg-gray-100 text-gray-600 border-gray-300">
                                              {shift.class_name}
                                            </Badge>
                                          )}
                                        </Label>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <Label className="text-sm font-medium block">
                              Available & not assigned
                            </Label>
                            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-gray-50">
                              {availableShifts.map((shift, idx) => {
                                const shiftKey = `${shift.date}|${shift.time_slot_code}`
                                const isSelected = selectedShifts.has(shiftKey)
                                
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md bg-white"
                                  >
                                    <Checkbox
                                      id={`shift-${idx}`}
                                      checked={isSelected}
                                      onCheckedChange={() => handleShiftToggle(shiftKey, true)}
                                    />
                                    <Label
                                      htmlFor={`shift-${idx}`}
                                      className="flex-1 cursor-pointer font-normal"
                                    >
                                      <Badge
                                        variant="outline"
                                        className={cn('text-xs', getShiftStatusColorClasses('available'))}
                                      >
                                        {formatShiftLabel(shift.date, shift.time_slot_code)}
                                      </Badge>
                                      {shift.class_name && (
                                        <Badge variant="outline" className="text-xs ml-2">
                                          {shift.class_name}
                                        </Badge>
                                      )}
                                    </Label>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )
                })()}

                {/* Unavailable Shifts (can override) */}
                {sub.cannot_cover && sub.cannot_cover.length > 0 && (
                  <>
                    {(assignedShifts.length > 0 || (sub.can_cover && sub.can_cover.length > 0)) && (
                      <div className="border-t pt-4" />
                    )}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Unavailable (can override)</Label>
                      </div>
                      <div className="space-y-2">
                        {sub.cannot_cover.map((shift, idx) => {
                          const shiftKey = `${shift.date}|${shift.time_slot_code}`
                          const isOverridden = overriddenShiftIds.has(shiftKey)
                          const isSelected = selectedShifts.has(shiftKey)
                          const canSelect = isOverridden && !isSubInactive && responseStatus !== 'declined_all'
                          
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${
                                isOverridden
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleShiftToggle(shiftKey, false)}
                                disabled={!canSelect}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-gray-100 text-gray-700 border-gray-300"
                                  >
                                    {formatShiftLabel(shift.date, shift.time_slot_code)}
                                  </Badge>
                                  {isOverridden && (
                                    <>
                                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                                        Override
                                      </Badge>
                                    </>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {shift.reason}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleOverride(shiftKey)}
                                disabled={isSubInactive || responseStatus === 'declined_all'}
                              >
                                Override
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-4 pb-6 border-t">
              {isDeclinedWithShiftsSelected ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-2">
                  <p className="text-sm text-amber-800">
                    ⚠️ Conflicting selections
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    You&apos;ve marked this sub as Declined (all) but also selected shifts.
                  </p>
                </div>
              ) : responseStatus === 'declined_all' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-2">
                  <p className="text-sm text-amber-800">
                    Declining all shifts
                  </p>
                </div>
              )}
              {isSubInactive && (
                <div className="rounded-lg bg-gray-100 border border-gray-300 p-3 mb-2">
                  <p className="text-sm text-gray-700">
                    This sub is inactive. Assignment is disabled.
                  </p>
                </div>
              )}
              <TooltipProvider>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  {isDeclinedWithShiftsSelected ? (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleMarkAsDeclined}
                        disabled={loading || fetching || !coverageRequestId}
                      >
                        Mark as Declined
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleChangeToConfirmed}
                        disabled={loading || fetching || !coverageRequestId}
                      >
                        Change to Confirmed
                      </Button>
                    </>
                  ) : responseStatus === 'declined_all' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            variant="outline"
                            className="flex-1 w-full"
                            onClick={handleSave}
                            disabled={true}
                          >
                            Save as Pending
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pending isn&apos;t applicable when a sub has declined all shifts.</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleSave}
                      disabled={loading || fetching || !coverageRequestId}
                    >
                      Save as Pending
                    </Button>
                  )}
                  {!isDeclinedWithShiftsSelected && (
                    <Button
                      variant="outline"
                      className={cn('flex-1', getButtonColors('teal').base)}
                      onClick={responseStatus === 'declined_all' && selectedShiftsCount === 0 ? handleMarkAsDeclinedSave : handleAssignShifts}
                      disabled={loading || fetching || !coverageRequestId || (responseStatus !== 'declined_all' && selectedShiftsCount === 0) || isSubInactive}
                    >
                      {responseStatus === 'declined_all' ? 'Mark as Declined' : 'Assign Selected Shifts'}
                    </Button>
                  )}
                </div>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
