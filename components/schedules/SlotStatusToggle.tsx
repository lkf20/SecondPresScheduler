'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface SlotStatusToggleProps {
  isActive: boolean
  onToggle: (isActive: boolean) => void
  disabled?: boolean
}

export default function SlotStatusToggle({
  isActive,
  onToggle,
  disabled = false,
}: SlotStatusToggleProps) {
  return (
    <div className="space-y-3 mb-2">
      <Label htmlFor="slot-status" className="text-base font-medium block">
        Slot Status
      </Label>
      <div className="flex items-center justify-between">
        <span
          className={`text-sm ${isActive ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
        <Switch
          id="slot-status"
          checked={isActive}
          onCheckedChange={onToggle}
          disabled={disabled}
          className={isActive ? 'data-[state=checked]:bg-blue-600' : ''}
        />
      </div>
    </div>
  )
}
