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
  }>
  cannot_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    reason: string
  }>
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
}

export default function ContactSubPanel({
  isOpen,
  onClose,
  sub,
  absence,
}: ContactSubPanelProps) {
  const [contactStatus, setContactStatus] = useState<'not_contacted' | 'contacted' | 'pending' | 'declined' | 'assigned'>('not_contacted')
  const [notes, setNotes] = useState('')
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [coverageRequestId, setCoverageRequestId] = useState<string | null>(null)
  const [shiftMap, setShiftMap] = useState<Record<string, string>>({})
  const [contactId, setContactId] = useState<string | null>(null)

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

        // Get or create substitute contact
        const contactResponse = await fetch(
          `/api/sub-finder/substitute-contacts?coverage_request_id=${coverageData.coverage_request_id}&sub_id=${sub.id}`
        )
        if (contactResponse.ok) {
          const contactData = await contactResponse.json()
          if (contactData) {
            setContactId(contactData.id)
            setContactStatus(contactData.status || 'not_contacted')
            setNotes(contactData.notes || '')

            // Load selected shifts from shift_overrides if they exist
            if (contactData.shift_overrides && contactData.shift_overrides.length > 0) {
              const selected = new Set<string>()
              contactData.shift_overrides.forEach((override: any) => {
                if (override.selected && override.shift) {
                  const key = `${override.shift.date}|${override.shift.time_slot?.code || ''}`
                  selected.add(key)
                }
              })
              setSelectedShifts(selected)
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
      setContactStatus('not_contacted')
      setNotes('')
      setSelectedShifts(new Set())
      setCoverageRequestId(null)
      setShiftMap({})
      setContactId(null)
    }
  }, [isOpen])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dayName = dayNames[date.getDay()]
    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    return `${dayName} ${month} ${day}`
  }

  if (!sub || !absence) {
    return null
  }

  if (fetching) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-muted-foreground">Loading contact information...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const handleShiftToggle = (shiftKey: string) => {
    const newSelected = new Set(selectedShifts)
    if (newSelected.has(shiftKey)) {
      newSelected.delete(shiftKey)
    } else {
      newSelected.add(shiftKey)
    }
    setSelectedShifts(newSelected)
  }

  const handleSave = async () => {
    if (!coverageRequestId) {
      console.error('Coverage request ID not available')
      return
    }

    setLoading(true)
    try {
      // Build shift overrides array
      const shiftOverrides = sub.can_cover?.map((shift) => {
        const shiftKey = `${shift.date}|${shift.time_slot_code}`
        const coverageRequestShiftId = shiftMap[shiftKey]
        return {
          coverage_request_shift_id: coverageRequestShiftId,
          selected: selectedShifts.has(shiftKey),
        }
      }).filter((override) => override.coverage_request_shift_id) || []

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

      // Update contact with status, notes, and shift overrides
      const updateResponse = await fetch('/api/sub-finder/substitute-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentContactId,
          status: contactStatus,
          notes: notes || null,
          shift_overrides: shiftOverrides,
        }),
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save contact')
      }

      onClose()
    } catch (error) {
      console.error('Error saving contact:', error)
      alert(`Error saving contact: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const selectedShiftsCount = selectedShifts.size
  const totalShifts = sub.can_cover?.length || 0

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
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
              {selectedShiftsCount > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Covering {selectedShiftsCount} of {totalShifts} selected shifts
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Coverage Summary */}
          <div>
            <h3 className="text-sm font-medium mb-2">Coverage Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Matches</span>
                <span className="font-medium">
                  {sub.shifts_covered} of {sub.total_shifts} shifts
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${sub.coverage_percent}%` }}
                />
              </div>
              {sub.cannot_cover && sub.cannot_cover.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Some shifts cannot be covered</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Status */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Contact Status</Label>
            <RadioGroup value={contactStatus} onValueChange={(value: any) => setContactStatus(value)}>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="not_contacted" id="not_contacted" />
                  <Label htmlFor="not_contacted" className="font-normal cursor-pointer">
                    Not contacted
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contacted" id="contacted" />
                  <Label htmlFor="contacted" className="font-normal cursor-pointer">
                    Contacted
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pending" id="pending" />
                  <Label htmlFor="pending" className="font-normal cursor-pointer">
                    Pending
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="declined" id="declined" />
                  <Label htmlFor="declined" className="font-normal cursor-pointer">
                    Declined
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="assigned" id="assigned" />
                  <Label htmlFor="assigned" className="font-normal cursor-pointer">
                    Assigned
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Contact Notes */}
          <div>
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

          {/* Assignable Shifts */}
          {sub.can_cover && sub.can_cover.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Shifts this sub can cover
              </Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                {sub.can_cover.map((shift, idx) => {
                  const shiftKey = `${shift.date}|${shift.time_slot_code}`
                  const isSelected = selectedShifts.has(shiftKey)
                  return (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md"
                    >
                      <Checkbox
                        id={`shift-${idx}`}
                        checked={isSelected}
                        onCheckedChange={() => handleShiftToggle(shiftKey)}
                      />
                      <Label
                        htmlFor={`shift-${idx}`}
                        className="flex-1 cursor-pointer font-normal"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatDate(shift.date)} {shift.time_slot_code}
                          </span>
                          {shift.class_name && (
                            <Badge variant="outline" className="text-xs">
                              {shift.class_name}
                            </Badge>
                          )}
                        </div>
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cannot Cover Shifts */}
          {sub.cannot_cover && sub.cannot_cover.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block text-amber-600">
                Cannot cover
              </Label>
              <div className="space-y-1 border rounded-md p-3 bg-amber-50">
                {sub.cannot_cover.map((shift, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">
                      {formatDate(shift.date)} {shift.time_slot_code}:
                    </span>{' '}
                    <span className="text-muted-foreground">{shift.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={loading || selectedShiftsCount === 0 || contactStatus === 'declined'}
            >
              {contactStatus === 'assigned' ? 'Save Assignment' : 'Save as Pending'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

