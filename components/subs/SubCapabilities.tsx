'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SubCapabilitiesProps {
  subId: string
  capabilities: {
    can_change_diapers: boolean | null
    can_lift_children: boolean | null
    can_assist_with_toileting: boolean | null
    capabilities_notes: string | null
  }
  onCapabilitiesChange: (capabilities: {
    can_change_diapers: boolean
    can_lift_children: boolean
    can_assist_with_toileting: boolean
    capabilities_notes: string | null
  }) => void
}

export default function SubCapabilities({
  capabilities,
  onCapabilitiesChange,
}: SubCapabilitiesProps) {
  const [localCapabilities, setLocalCapabilities] = useState({
    can_change_diapers: capabilities.can_change_diapers ?? false,
    can_lift_children: capabilities.can_lift_children ?? false,
    can_assist_with_toileting: capabilities.can_assist_with_toileting ?? false,
    capabilities_notes: capabilities.capabilities_notes || '',
  })
  // Sync with props when they change
  useEffect(() => {
    setLocalCapabilities({
      can_change_diapers: capabilities.can_change_diapers ?? false,
      can_lift_children: capabilities.can_lift_children ?? false,
      can_assist_with_toileting: capabilities.can_assist_with_toileting ?? false,
      capabilities_notes: capabilities.capabilities_notes || '',
    })
  }, [capabilities])

  const handleCheckboxChange = (field: string, checked: boolean) => {
    const updated = {
      ...localCapabilities,
      [field]: checked,
    }
    setLocalCapabilities(updated)
    onCapabilitiesChange({
      ...updated,
      capabilities_notes: updated.capabilities_notes || null,
    })
  }

  const handleNotesChange = (notes: string) => {
    const updated = {
      ...localCapabilities,
      capabilities_notes: notes,
    }
    setLocalCapabilities(updated)
    onCapabilitiesChange({
      ...updated,
      capabilities_notes: notes.trim() || null,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capabilities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_change_diapers"
              checked={localCapabilities.can_change_diapers}
              onCheckedChange={(checked) =>
                handleCheckboxChange('can_change_diapers', checked === true)
              }
            />
            <Label htmlFor="can_change_diapers" className="font-normal cursor-pointer">
              Can change diapers
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_lift_children"
              checked={localCapabilities.can_lift_children}
              onCheckedChange={(checked) =>
                handleCheckboxChange('can_lift_children', checked === true)
              }
            />
            <Label htmlFor="can_lift_children" className="font-normal cursor-pointer">
              Can lift children
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_assist_with_toileting"
              checked={localCapabilities.can_assist_with_toileting}
              onCheckedChange={(checked) =>
                handleCheckboxChange('can_assist_with_toileting', checked === true)
              }
            />
            <Label htmlFor="can_assist_with_toileting" className="font-normal cursor-pointer">
              Can assist with toileting
            </Label>
          </div>
        </div>

        <div>
          <Label htmlFor="capabilities_notes" className="text-sm">
            Notes (optional)
          </Label>
          <Textarea
            id="capabilities_notes"
            value={localCapabilities.capabilities_notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            className="mt-2 min-h-[80px]"
            placeholder="Add any additional notes about capabilities..."
          />
        </div>
      </CardContent>
    </Card>
  )
}


