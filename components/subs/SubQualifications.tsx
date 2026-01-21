'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  onQualificationsChange: (qualifications: Array<{
    qualification_id: string
    level?: string | null
    expires_on?: string | null
    verified?: boolean | null
    notes?: string | null
  }>) => void
}

export default function SubQualifications({
  qualifications,
  onQualificationsChange,
}: SubQualificationsProps) {
  const [definitions, setDefinitions] = useState<QualificationDefinition[]>([])
  const [selectedQualIds, setSelectedQualIds] = useState<Set<string>>(new Set())
  const [qualDetails, setQualDetails] = useState<Map<string, QualificationDetail>>(new Map())

  // Fetch qualification definitions
  useEffect(() => {
    fetch('/api/qualifications?active_only=true')
      .then((r) => r.json())
      .then((data) => {
        setDefinitions(data)
      })
      .catch(console.error)
  }, [])

  // Initialize from props
  useEffect(() => {
    const selected = new Set<string>()
    const details = new Map<string, QualificationDetail>()

    qualifications.forEach((q) => {
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

  const handleQualificationToggle = (qualId: string, checked: boolean) => {
    const newSelected = new Set(selectedQualIds)
    if (checked) {
      newSelected.add(qualId)
      // Initialize details if not present
      if (!qualDetails.has(qualId)) {
        setQualDetails(new Map(qualDetails).set(qualId, {
          level: null,
          expires_on: null,
          verified: null,
          notes: null,
        }))
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

  const notifyChange = (
    selected: Set<string>,
    details: Map<string, QualificationDetail>
  ) => {
    const quals = Array.from(selected).map((qualId) => {
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

  // Group qualifications by category
  const groupedByCategory = definitions.reduce((acc, def) => {
    const category = def.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(def)
    return acc
  }, {} as Record<string, QualificationDefinition[]>)

  const categories = Object.keys(groupedByCategory).sort()

  return (
    <div className="space-y-4">
      <Label>Qualifications</Label>
      
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No qualifications defined</p>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-sm">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupedByCategory[category].map((def) => {
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
                          onCheckedChange={(checked) =>
                            handleQualificationToggle(def.id, checked === true)
                          }
                        />
                        <Label htmlFor={`qual-${def.id}`} className="font-normal cursor-pointer flex-1">
                          {def.name}
                        </Label>
                      </div>

                      {isSelected && (
                        <div className="ml-6 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`level-${def.id}`} className="text-xs">
                                Level (optional)
                              </Label>
                              <Select
                                value={details.level || undefined}
                                onValueChange={(value) =>
                                  handleDetailChange(def.id, 'level', value === 'none' ? null : value)
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

                            <div>
                              <Label htmlFor={`expires-${def.id}`} className="text-xs">
                                Expires on (optional)
                              </Label>
                              <DatePickerInput
                                id={`expires-${def.id}`}
                                value={details.expires_on || ''}
                                onChange={(value) =>
                                  handleDetailChange(def.id, 'expires_on', value || null)
                                }
                                placeholder="Select date"
                                allowClear
                                className="h-8 rounded-md px-2 text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`verified-${def.id}`}
                              checked={details.verified ?? false}
                              onCheckedChange={(checked) =>
                                handleDetailChange(def.id, 'verified', checked === true)
                              }
                            />
                            <Label htmlFor={`verified-${def.id}`} className="text-xs font-normal cursor-pointer">
                              Verified
                            </Label>
                          </div>

                          <div>
                            <Label htmlFor={`notes-${def.id}`} className="text-xs">
                              Notes (optional)
                            </Label>
                            <Textarea
                              id={`notes-${def.id}`}
                              value={details.notes || ''}
                              onChange={(e) =>
                                handleDetailChange(def.id, 'notes', e.target.value || null)
                              }
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
    </div>
  )
}
