'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { X, Phone, Mail, AlertTriangle } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils/date'
import ShiftChips, { formatShiftLabel } from '@/components/sub-finder/ShiftChips'
import { toast } from 'sonner'

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
  can_change_diapers?: boolean
  can_lift_children?: boolean
}

interface Absence {
  id: string
  teacher_name: string
  start_date: string
  end_date: string | null
}

interface ContactSubPanelProps {
  isOpen: boolean
  onClose: () => void
  sub: RecommendedSub | null
  absence: Absence | null
  onAssignmentComplete?: () => void // Callback to refresh data after assignment
}

export default function ContactSubPanel({
  isOpen,
  onClose,
  sub,
  absence,
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
  const [shiftMap, setShiftMap] = useState<Record<string, string>>({})
  const [contactId, setContactId] = useState<string | null>(null)
  const [overriddenShiftIds, setOverriddenShiftIds] = useState<Set<string>>(new Set())
  const [isSubInactive, setIsSubInactive] = useState(false)

  // Fetch coverage request and existing contact data when panel opens
  useEffect(() => {
    if (!isOpen || !sub || !absence) return

    const fetchData = async () => {
      setFetching(true)
      try {
        // Get coverage_request_id and shift map
        const coverageResponse = await fetch(`/api/sub-finder/coverage-request/${absence.id}`)
        if (!coverageResponse.ok) {
          console.error('Failed to fetch coverage request')
          return
        }
        const coverageData = await coverageResponse.json()
        setCoverageRequestId(coverageData.coverage_request_id)
        setShiftMap(coverageData.shift_map || {})

        // Check if sub is inactive
        try {
          const subResponse = await fetch(`/api/subs/${sub.id}`)
          if (subResponse.ok) {
            const subData = await subResponse.json()
            setIsSubInactive(!subData.active)
          }
        } catch (error) {
          console.error('Error fetching sub details:', error)
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
            setAssignedShifts(contactData.assigned_shifts || [])

            // Load selected shifts and override state from shift_overrides if they exist
            if (contactData.shift_overrides && contactData.shift_overrides.length > 0) {
              const selected = new Set<string>()
              const overridden = new Set<string>()
              contactData.shift_overrides.forEach((override: any) => {
                if (override.selected && override.shift) {
                  const shiftId = override.coverage_request_shift_id || 
                    `${override.shift.date}|${override.shift.time_slot?.code || ''}`
                  const key = `${override.shift.date}|${override.shift.time_slot?.code || ''}`
                  selected.add(key)
                  // Also track by shift ID for unavailable shifts
                  if (override.override_availability) {
                    overridden.add(shiftId)
                    overridden.add(key)
                  }
                }
              })
              setSelectedShifts(selected)
              setOverriddenShiftIds(overridden)
            } else {
              // Initialize to all can_cover shifts if no overrides exist
              if (sub.can_cover) {
                const shiftKeys = sub.can_cover.map(
                  (shift) => `${shift.date}|${shift.time_slot_code}`
                )
                setSelectedShifts(new Set(shiftKeys))
              }
            }
          } else {
            // No contact exists yet, initialize to all can_cover shifts
            if (sub.can_cover) {
              const shiftKeys = sub.can_cover.map(
                (shift) => `${shift.date}|${shift.time_slot_code}`
              )
              setSelectedShifts(new Set(shiftKeys))
            }
          }
        }
      } catch (error) {
        console.error('Error fetching contact data:', error)
        // Fallback: initialize to all can_cover shifts
        if (sub.can_cover) {
          const shiftKeys = sub.can_cover.map(
            (shift) => `${shift.date}|${shift.time_slot_code}`
          )
          setSelectedShifts(new Set(shiftKeys))
        }
      } finally {
        setFetching(false)
      }
    }

    fetchData()
  }, [isOpen, sub, absence])

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
      setShiftMap({})
      setContactId(null)
      setOverriddenShiftIds(new Set())
      setIsSubInactive(false)
    }
  }, [isOpen])

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
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-gray-50 p-0">
          <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-6 pt-6 pb-4">
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

  if (fetching) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-gray-50 p-0">
          <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-6 pt-6 pb-4">
            <SheetHeader>
              <SheetTitle>Loading...</SheetTitle>
            </SheetHeader>
          </div>
          <div className="px-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                <p className="text-muted-foreground">Loading contact information...</p>
              </div>
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

  const handleToggleOverride = (shiftId: string) => {
    setOverriddenShiftIds((prev) => {
      const next = new Set(prev)
      if (next.has(shiftId)) {
        next.delete(shiftId)
      } else {
        next.add(shiftId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!coverageRequestId) {
      console.error('Coverage request ID not available')
      return
    }

    setLoading(true)
    try {
      // Build shift overrides array for available shifts
      const availableShiftOverrides = sub.can_cover?.map((shift) => {
        const shiftKey = `${shift.date}|${shift.time_slot_code}`
        const coverageRequestShiftId = shiftMap[shiftKey]
        return {
          coverage_request_shift_id: coverageRequestShiftId,
          selected: selectedShifts.has(shiftKey),
          override_availability: false,
        }
      }).filter((override) => override.coverage_request_shift_id) || []

      // Build shift overrides array for unavailable shifts
      const unavailableShiftOverrides = sub.cannot_cover?.map((shift) => {
        const shiftId = shift.coverage_request_shift_id || 
          `${shift.date}|${shift.time_slot_code}`
        const shiftKey = `${shift.date}|${shift.time_slot_code}`
        const coverageRequestShiftId = shift.coverage_request_shift_id || shiftMap[shiftKey]
        return {
          coverage_request_shift_id: coverageRequestShiftId,
          selected: selectedShifts.has(shiftKey),
          override_availability: overriddenShiftIds.has(shiftId) || overriddenShiftIds.has(shiftKey),
        }
      }).filter((override) => override.coverage_request_shift_id) || []

      const shiftOverrides = [...availableShiftOverrides, ...unavailableShiftOverrides]

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
          shift_overrides: shiftOverrides,
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

      // Build shift overrides array and get selected shift IDs (from both available and unavailable)
      const selectedShiftIds: string[] = []
      
      // Add available shifts
      sub.can_cover?.forEach((shift) => {
        const shiftKey = `${shift.date}|${shift.time_slot_code}`
        if (selectedShifts.has(shiftKey)) {
          const coverageRequestShiftId = shiftMap[shiftKey]
          if (coverageRequestShiftId) {
            selectedShiftIds.push(coverageRequestShiftId)
          }
        }
      })
      
      // Add unavailable shifts that are overridden and selected
      sub.cannot_cover?.forEach((shift) => {
        const shiftId = shift.coverage_request_shift_id || 
          `${shift.date}|${shift.time_slot_code}`
        const shiftKey = `${shift.date}|${shift.time_slot_code}`
        if (selectedShifts.has(shiftKey) && (overriddenShiftIds.has(shiftId) || overriddenShiftIds.has(shiftKey))) {
          const coverageRequestShiftId = shift.coverage_request_shift_id || shiftMap[shiftKey]
          if (coverageRequestShiftId) {
            selectedShiftIds.push(coverageRequestShiftId)
          }
        }
      })

      if (selectedShiftIds.length === 0) {
        throw new Error('No valid shifts selected for assignment')
      }

      // Build shift overrides array for available shifts
      const availableShiftOverrides = sub.can_cover?.map((shift) => {
        const shiftKey = `${shift.date}|${shift.time_slot_code}`
        const coverageRequestShiftId = shiftMap[shiftKey]
        return {
          coverage_request_shift_id: coverageRequestShiftId,
          selected: selectedShifts.has(shiftKey),
          override_availability: false,
        }
      }).filter((override) => override.coverage_request_shift_id) || []

      // Build shift overrides array for unavailable shifts
      const unavailableShiftOverrides = sub.cannot_cover?.map((shift) => {
        const shiftId = shift.coverage_request_shift_id || 
          `${shift.date}|${shift.time_slot_code}`
        const shiftKey = `${shift.date}|${shift.time_slot_code}`
        const coverageRequestShiftId = shift.coverage_request_shift_id || shiftMap[shiftKey]
        return {
          coverage_request_shift_id: coverageRequestShiftId,
          selected: selectedShifts.has(shiftKey),
          override_availability: overriddenShiftIds.has(shiftId) || overriddenShiftIds.has(shiftKey),
        }
      }).filter((override) => override.coverage_request_shift_id) || []

      const shiftOverrides = [...availableShiftOverrides, ...unavailableShiftOverrides]

      // Validate shift overrides before sending
      const validShiftOverrides = shiftOverrides.filter(
        (override) => override.coverage_request_shift_id
      )

      if (validShiftOverrides.length !== shiftOverrides.length) {
        console.warn(
          `Filtered out ${shiftOverrides.length - validShiftOverrides.length} invalid shift overrides`
        )
      }

      const updatePayload = {
        id: currentContactId,
        response_status: responseStatus,
        is_contacted: isContacted,
        notes: notes || null,
        shift_overrides: validShiftOverrides,
      }

      console.log('Updating contact with payload:', {
        ...updatePayload,
        shift_overrides_count: validShiftOverrides.length,
      })

      const updateResponse = await fetch('/api/sub-finder/substitute-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        let errorData: any = {}
        let errorMessage = `Failed to update contact (${updateResponse.status} ${updateResponse.statusText})`
        
        try {
          if (errorText) {
            errorData = JSON.parse(errorText)
            errorMessage = errorData.error || errorData.message || errorMessage
          }
        } catch (parseError) {
          // If JSON parsing fails, use the raw text
          errorMessage = errorText || errorMessage
          errorData = { rawError: errorText }
        }
        
        console.error('Update contact error:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          errorText: errorText || '(empty response)',
          errorData,
          payload: {
            ...updatePayload,
            shift_overrides_count: updatePayload.shift_overrides.length,
          },
        })
        
        throw new Error(errorMessage)
      }

      // Create calendar entries (sub_assignments)
      const assignPayload = {
        coverage_request_id: coverageRequestId,
        sub_id: sub.id,
        selected_shift_ids: selectedShiftIds,
      }

      console.log('Assigning shifts with payload:', assignPayload)

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
        let errorData: any = {}
        let errorMessage = `Failed to assign shifts (${assignResponse.status} ${assignResponse.statusText})`
        
        try {
          if (errorText) {
            errorData = JSON.parse(errorText)
            errorMessage = errorData.error || errorData.message || errorMessage
          }
        } catch (parseError) {
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

      // Don't close - keep panel open so user can see the updated status
    } catch (error) {
      console.error('Error assigning shifts:', error)
      alert(`Error assigning shifts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const selectedShiftsCount = selectedShifts.size
  const totalShifts = sub.can_cover?.length || 0

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-gray-50 p-0">
        <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-6 pt-6 pb-4">
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
              Available for {sub.shifts_covered} of {sub.total_shifts} requested shifts
            </p>
          </SheetHeader>
        </div>

        <div className="px-6">
          <div className="mt-6 space-y-10">
            {/* Coverage Summary */}
            <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Coverage Summary</h3>
                <span className="text-sm text-muted-foreground">
                  {sub.shifts_covered} of {sub.total_shifts} shifts
                </span>
              </div>
              {(sub.can_cover && sub.can_cover.length > 0) || (sub.cannot_cover && sub.cannot_cover.length > 0) || assignedShifts.length > 0 ? (
                <ShiftChips
                  canCover={sub.can_cover || []}
                  cannotCover={sub.cannot_cover || []}
                  assigned={assignedShifts.map(shift => ({
                    date: shift.date,
                    time_slot_code: shift.time_slot_code,
                  }))}
                  showLegend={true}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No shifts available</p>
              )}
              {/* Status */}
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">Status</Label>
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
                <div className="space-y-2 border-t pt-4">
                  <Label className="text-sm font-medium mb-3 block">Response</Label>
                  <RadioGroup value={responseStatus} onValueChange={(value: any) => setResponseStatus(value)}>
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
            </div>

            {/* Shifts Assigned to This Sub */}
            {assignedShifts.length > 0 && (
              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-2">
                <Label className="text-sm font-medium mb-3 block">
                  Shifts assigned to this sub
                </Label>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-gray-50">
                  {assignedShifts.map((shift, idx) => {
                    const shiftKey = `${shift.date}|${shift.time_slot_code}`
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
                            className="text-xs bg-blue-50 text-blue-900 border-blue-200"
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

            {/* Assignable Shifts */}
            {sub.can_cover && sub.can_cover.length > 0 && (
              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-2">
                <Label className="text-sm font-medium mb-3 block">
                  Shifts to assign to sub
                </Label>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-gray-50">
                  {sub.can_cover.map((shift, idx) => {
                    const shiftKey = `${shift.date}|${shift.time_slot_code}`
                    const isSelected = selectedShifts.has(shiftKey)
                    // Skip if already assigned
                    const isAssigned = assignedShifts.some(
                      (as) => as.date === shift.date && as.time_slot_code === shift.time_slot_code
                    )
                    if (isAssigned) return null
                    
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
                            className="text-xs bg-emerald-50 text-emerald-900 border-emerald-200"
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
              </div>
            )}

            {/* Unavailable Shifts (can override) */}
            {sub.cannot_cover && sub.cannot_cover.length > 0 && (
              <div className="rounded-lg bg-white border border-gray-200 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Unavailable (can override)</Label>
                </div>
                <div className="space-y-2">
                  {sub.cannot_cover.map((shift, idx) => {
                    const shiftId = shift.coverage_request_shift_id || 
                      `${shift.date}|${shift.time_slot_code}`
                    const shiftKey = `${shift.date}|${shift.time_slot_code}`
                    const isOverridden = overriddenShiftIds.has(shiftId) || overriddenShiftIds.has(shiftKey)
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
                          onClick={() => handleToggleOverride(shiftId)}
                          disabled={isSubInactive || responseStatus === 'declined_all'}
                        >
                          Override
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-4 pb-6 border-t">
              {responseStatus === 'declined_all' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-2">
                  <p className="text-sm text-amber-800">
                    Cannot assign shifts to a declined sub
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={loading}
                >
                  Save as Pending
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAssignShifts}
                  disabled={loading || selectedShiftsCount === 0 || responseStatus === 'declined_all' || isSubInactive}
                >
                  Assign Selected Shifts
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

