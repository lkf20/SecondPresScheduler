'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface QualificationDefinition {
  id: string
  name: string
  category: string | null
  is_system: boolean
  is_active: boolean
}

interface StaffQualification {
  id: string
  qualification_id: string
  level: string | null
  expires_on: string | null
  verified: boolean | null
  notes: string | null
  qualification?: QualificationDefinition
}

type QualificationDetail = {
  level: string | null
  expires_on: string | null
  verified: boolean | null
  notes: string | null
}

interface SubQualificationsProps {
  subId: string
  qualifications: StaffQualification[]
  capabilities: {
    can_change_diapers: boolean | null
    can_lift_children: boolean | null
    can_assist_with_toileting: boolean | null
    capabilities_notes: string | null
  }
  onQualificationsChange: (
    qualifications: Array<{
      qualification_id: string
      level?: string | null
      expires_on?: string | null
      verified?: boolean | null
      notes?: string | null
    }>
  ) => void
  onCapabilitiesChange: (capabilities: {
    can_change_diapers: boolean
    can_lift_children: boolean
    can_assist_with_toileting: boolean
    capabilities_notes: string | null
  }) => void
}

export default function SubQualifications({
  qualifications,
  capabilities,
  onQualificationsChange,
  onCapabilitiesChange,
}: SubQualificationsProps) {
  const [capabilitiesState, setCapabilitiesState] = useState({
    can_change_diapers: capabilities.can_change_diapers ?? false,
    can_lift_children: capabilities.can_lift_children ?? false,
    can_assist_with_toileting: capabilities.can_assist_with_toileting ?? false,
    capabilities_notes: capabilities.capabilities_notes || '',
  })
  const [definitions, setDefinitions] = useState<QualificationDefinition[]>([])
  const [selectedQualIds, setSelectedQualIds] = useState<Set<string>>(new Set())
  const [qualDetails, setQualDetails] = useState<Map<string, QualificationDetail>>(new Map())

  // Fetch qualification definitions
  useEffect(() => {
    fetch('/api/qualifications?active_only=true')
      .then(r => r.json())
      .then(data => {
        setDefinitions(data)
      })
      .catch(console.error)
  }, [])

  // Initialize from props
  useEffect(() => {
    const selected = new Set<string>()
    const details = new Map<string, QualificationDetail>()

    qualifications.forEach(q => {
      if (q.qualification?.name === 'Infant qualified') {
        return
      }
      selected.add(q.qualification_id)
      details.set(q.qualification_id, {
        level: q.level,
        expires_on: q.expires_on,
        verified: q.verified,
        notes: q.notes,
      })
    })

    setSelectedQualIds(selected)
    setQualDetails(details)
  }, [qualifications])

  useEffect(() => {
    setCapabilitiesState({
      can_change_diapers: capabilities.can_change_diapers ?? false,
      can_lift_children: capabilities.can_lift_children ?? false,
      can_assist_with_toileting: capabilities.can_assist_with_toileting ?? false,
      capabilities_notes: capabilities.capabilities_notes || '',
    })
  }, [capabilities])

  const handleQualificationToggle = (qualId: string, checked: boolean) => {
    const newSelected = new Set(selectedQualIds)
    if (checked) {
      newSelected.add(qualId)
      // Initialize details if not present
      if (!qualDetails.has(qualId)) {
        setQualDetails(
          new Map(qualDetails).set(qualId, {
            level: null,
            expires_on: null,
            verified: null,
            notes: null,
          })
        )
      }
    } else {
      newSelected.delete(qualId)
      const updated = new Map(qualDetails)
      updated.delete(qualId)
      setQualDetails(updated)
    }
    setSelectedQualIds(newSelected)
    notifyChange(newSelected, qualDetails)
  }

  const handleDetailChange = (
    qualId: string,
    field: keyof QualificationDetail,
    value: QualificationDetail[keyof QualificationDetail]
  ) => {
    const updated = new Map(qualDetails)
    const current = updated.get(qualId) || {
      level: null,
      expires_on: null,
      verified: null,
      notes: null,
    }
    updated.set(qualId, { ...current, [field]: value })
    setQualDetails(updated)
    notifyChange(selectedQualIds, updated)
  }

  const notifyChange = (selected: Set<string>, details: Map<string, QualificationDetail>) => {
    const quals = Array.from(selected).map(qualId => {
      const detail = details.get(qualId) || {
        level: null,
        expires_on: null,
        verified: null,
        notes: null,
      }
      return {
        qualification_id: qualId,
        ...detail,
      }
    })
    onQualificationsChange(quals)
  }

  const handleCapabilitiesUpdate = (next: {
    can_change_diapers: boolean
    can_lift_children: boolean
    can_assist_with_toileting: boolean
    capabilities_notes: string | null
  }) => {
    setCapabilitiesState({
      can_change_diapers: next.can_change_diapers,
      can_lift_children: next.can_lift_children,
      can_assist_with_toileting: next.can_assist_with_toileting,
      capabilities_notes: next.capabilities_notes || '',
    })
    onCapabilitiesChange(next)
  }

  const handleCapabilityToggle = (field: keyof typeof capabilitiesState, checked: boolean) => {
    const updated = {
      ...capabilitiesState,
      [field]: checked,
    }
    handleCapabilitiesUpdate({
      ...updated,
      capabilities_notes: updated.capabilities_notes.trim() || null,
    })
  }

  const handleCapabilitiesNotesChange = (notes: string) => {
    setCapabilitiesState(prev => ({
      ...prev,
      capabilities_notes: notes,
    }))
    onCapabilitiesChange({
      ...capabilitiesState,
      capabilities_notes: notes,
    })
  }

  // Group qualifications by category
  const groupedByCategory = definitions.reduce(
    (acc, def) => {
      if (def.name === 'Infant qualified') {
        return acc
      }
      const category =
        def.category === 'Certification'
          ? 'Certifications'
          : def.category === 'Skill'
            ? 'Skills'
            : def.category || 'Other'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(def)
      return acc
    },
    {} as Record<string, QualificationDefinition[]>
  )

  const categories = Object.keys(groupedByCategory)
    .filter(category => category !== 'Skills')
    .sort()

  // TODO: Enable Skills category once skill tracking UI is ready.

  return (
    <div className="space-y-6 pt-2">
      <h3 className="text-base font-semibold text-slate-900">Qualifications</h3>

      <div className="rounded-lg border bg-white p-4 space-y-4">
        <h4 className="text-sm font-semibold text-slate-900">Capabilities</h4>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_change_diapers"
              checked={capabilitiesState.can_change_diapers}
              onCheckedChange={checked =>
                handleCapabilityToggle('can_change_diapers', checked === true)
              }
            />
            <Label htmlFor="can_change_diapers" className="font-normal cursor-pointer">
              Can change diapers
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_lift_children"
              checked={capabilitiesState.can_lift_children}
              onCheckedChange={checked =>
                handleCapabilityToggle('can_lift_children', checked === true)
              }
            />
            <Label htmlFor="can_lift_children" className="font-normal cursor-pointer">
              Can lift children
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_assist_with_toileting"
              checked={capabilitiesState.can_assist_with_toileting}
              onCheckedChange={checked =>
                handleCapabilityToggle('can_assist_with_toileting', checked === true)
              }
            />
            <Label htmlFor="can_assist_with_toileting" className="font-normal cursor-pointer">
              Can assist with toileting
            </Label>
          </div>
        </div>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No qualifications defined</p>
      ) : (
        <div className="space-y-4">
          {categories.map(category => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-sm">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupedByCategory[category].map(def => {
                  const isSelected = selectedQualIds.has(def.id)
                  const details = qualDetails.get(def.id) || {
                    level: null,
                    expires_on: null,
                    verified: null,
                    notes: null,
                  }

                  return (
                    <div key={def.id} className="space-y-3 border-b last:border-b-0 pb-3 last:pb-0">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`qual-${def.id}`}
                          checked={isSelected}
                          onCheckedChange={checked =>
                            handleQualificationToggle(def.id, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`qual-${def.id}`}
                          className="font-normal cursor-pointer flex-1"
                        >
                          {def.name}
                        </Label>
                      </div>

                      {isSelected && (
                        <div className="ml-6 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            {def.name !== 'CPR certified' && (
                              <div>
                                <Label htmlFor={`level-${def.id}`} className="text-xs">
                                  Level (optional)
                                </Label>
                                <Select
                                  value={details.level || undefined}
                                  onValueChange={value =>
                                    handleDetailChange(
                                      def.id,
                                      'level',
                                      value === 'none' ? null : value
                                    )
                                  }
                                >
                                  <SelectTrigger id={`level-${def.id}`} className="h-8 text-sm">
                                    <SelectValue placeholder="Select level" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="beginner">Beginner</SelectItem>
                                    <SelectItem value="intermediate">Intermediate</SelectItem>
                                    <SelectItem value="advanced">Advanced</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div>
                              <Label htmlFor={`expires-${def.id}`} className="text-xs">
                                Expires on (optional)
                              </Label>
                              <DatePickerInput
                                id={`expires-${def.id}`}
                                value={details.expires_on || ''}
                                onChange={value =>
                                  handleDetailChange(def.id, 'expires_on', value || null)
                                }
                                placeholder="Select date"
                                allowClear
                                className="h-8 rounded-md px-2 text-xs"
                              />
                            </div>
                          </div>

                          {def.name !== 'CPR certified' && (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`verified-${def.id}`}
                                checked={details.verified ?? false}
                                onCheckedChange={checked =>
                                  handleDetailChange(def.id, 'verified', checked === true)
                                }
                              />
                              <Label
                                htmlFor={`verified-${def.id}`}
                                className="text-xs font-normal cursor-pointer"
                              >
                                Verified
                              </Label>
                            </div>
                          )}

                          <div>
                            <Label htmlFor={`notes-${def.id}`} className="text-xs">
                              Notes (optional)
                            </Label>
                            <Textarea
                              id={`notes-${def.id}`}
                              value={details.notes || ''}
                              onChange={e => handleDetailChange(def.id, 'notes', e.target.value)}
                              className="text-sm min-h-[60px]"
                              placeholder="Add notes about this qualification..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div>
        <Label htmlFor="capabilities_notes" className="text-sm">
          Notes (optional)
        </Label>
        <Textarea
          id="capabilities_notes"
          value={capabilitiesState.capabilities_notes}
          onChange={e => handleCapabilitiesNotesChange(e.target.value)}
          className="mt-2 min-h-[80px]"
          placeholder="Any additional notes about preferences or qualifications"
        />
      </div>
    </div>
  )
}
