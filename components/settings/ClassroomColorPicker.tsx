'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Predefined colors with darker yellow
const PREDEFINED_COLORS = [
  { name: 'Maroon', value: '#991B1B' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Pink', value: '#C2185B' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Yellow', value: '#D4A017' }, // Darker/muted yellow
  { name: 'Dark Green', value: '#14532D' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Dark Blue', value: '#1E40AF' },
  { name: 'Medium Blue', value: '#2563EB' },
  { name: 'Light Blue', value: '#60A5FA' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Purple', value: '#9333EA' },
  { name: 'Brown', value: '#92400E' },
  { name: 'Light Brown', value: '#A16207' },
  { name: 'Dark Gray', value: '#374151' },
  { name: 'Light Gray', value: '#6B7280' },
]

interface ClassroomColorPickerProps {
  value: string | null
  onChange: (color: string | null) => void
}

export default function ClassroomColorPicker({ value, onChange }: ClassroomColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handlePredefinedColorClick = (colorValue: string) => {
    onChange(colorValue)
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setIsOpen(false)
  }

  const isPredefinedColor = value && PREDEFINED_COLORS.find(c => c.value === value)
  const selectedColorName = isPredefinedColor
    ? PREDEFINED_COLORS.find(c => c.value === value)?.name
    : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="w-[200px] justify-start">
              <div
                className="w-4 h-4 rounded border border-gray-300 mr-2"
                style={{ backgroundColor: value || 'transparent' }}
              />
              {value ? (
                <span className="text-sm">{selectedColorName || 'No color selected'}</span>
              ) : (
                <span className="text-sm text-muted-foreground">No color selected</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Select Color</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PREDEFINED_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => handlePredefinedColorClick(color.value)}
                      className={`w-10 h-10 rounded transition-all ${
                        value === color.value
                          ? 'ring-2 ring-gray-900 scale-110'
                          : 'hover:ring-1 hover:ring-gray-300'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {value && (
                <div className="border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="w-full"
                  >
                    Clear Color
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {value && selectedColorName && (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded border border-gray-300"
              style={{ backgroundColor: value }}
            />
            <span className="text-sm text-muted-foreground">{selectedColorName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
