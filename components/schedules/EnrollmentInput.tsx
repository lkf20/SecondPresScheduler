'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface EnrollmentInputProps {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  showUseDefault?: boolean
  onUseDefault?: () => void
}

export default function EnrollmentInput({
  value,
  onChange,
  disabled = false,
  showUseDefault = false,
  onUseDefault,
}: EnrollmentInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '') {
      onChange(null)
    } else {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num > 0) {
        onChange(num)
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-6">
        <Label htmlFor="enrollment" className="text-base font-medium">
          Enrollment (for staffing)
        </Label>
        {showUseDefault && onUseDefault && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onUseDefault}
            disabled={disabled}
          >
            Use default
          </Button>
        )}
      </div>
      <Input
        id="enrollment"
        type="number"
        min="1"
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled}
        placeholder="Enter enrollment"
      />
      <p className="text-sm text-muted-foreground">
        Used to calculate required/preferred staffing. Not daily attendance.
      </p>
      {!value && !disabled && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Enrollment not set. Staffing requirements cannot be calculated.</span>
        </div>
      )}
    </div>
  )
}
