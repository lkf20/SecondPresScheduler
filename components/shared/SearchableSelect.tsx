'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  id: string
  label: string
  [key: string]: unknown
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  placeholder?: string
  getDisplayName?: (option: SearchableSelectOption) => string
  disabled?: boolean
  className?: string
  emptyMessage?: string
}

export default function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Search...',
  getDisplayName = option => option.label,
  disabled = false,
  className,
  emptyMessage = 'No matches',
}: SearchableSelectProps) {
  const [searchInput, setSearchInput] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.id === value) || null
  }, [options, value])

  const filteredOptions = useMemo(() => {
    if (!searchInput.trim()) return options
    const query = searchInput.toLowerCase()
    return options.filter(option => {
      const label = getDisplayName(option).toLowerCase()
      return label.includes(query)
    })
  }, [options, searchInput, getDisplayName])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchInput(newValue)
    setIsDropdownOpen(true)
    // Clear selection if user is typing
    if (value) {
      onValueChange(null)
    }
  }

  const handleInputFocus = () => {
    setSearchInput('')
    setIsDropdownOpen(true)
  }

  const handleInputBlur = () => {
    setTimeout(() => {
      setIsDropdownOpen(false)
      setSearchInput('')
    }, 150)
  }

  const handleOptionSelect = (optionId: string) => {
    onValueChange(optionId)
    setSearchInput('')
    setIsDropdownOpen(false)
  }

  const displayValue = selectedOption ? getDisplayName(selectedOption) : searchInput

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-2 py-1">
          <Input
            placeholder={placeholder}
            value={displayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            disabled={disabled}
            className="h-8 border-0 bg-slate-50 text-sm focus-visible:ring-0"
          />
        </div>
        {isDropdownOpen && (
          <div className="max-h-52 overflow-y-auto p-2">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">{emptyMessage}</div>
            ) : (
              <div className="space-y-1">
                {filteredOptions.map(option => {
                  const label = getDisplayName(option)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                      onClick={() => handleOptionSelect(option.id)}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
