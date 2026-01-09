'use client'

import { User, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface SubCardHeaderProps {
  name: string
  phone: string | null
  shiftsCovered: number
  totalShifts: number
  coveragePercent?: number
  isDeclined?: boolean
}

export default function SubCardHeader({
  name,
  phone,
  shiftsCovered,
  totalShifts,
  coveragePercent,
  isDeclined = false,
}: SubCardHeaderProps) {
  // Calculate coverage percent if not provided
  const percent = coveragePercent ?? (totalShifts > 0 ? Math.round((shiftsCovered / totalShifts) * 100) : 0)

  // Determine bar color based on coverage percentage
  const getBarColor = () => {
    if (percent >= 80) return 'bg-emerald-500'
    if (percent >= 50) return 'bg-amber-500'
    if (percent > 0) return 'bg-orange-500'
    return 'bg-gray-400'
  }

  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <h3 className="font-semibold text-base">{name}</h3>
          {phone && (
            <>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{phone}</span>
              </div>
            </>
          )}
          {isDeclined && (
            <Badge variant="secondary" className="text-xs">
              Declined
            </Badge>
          )}
        </div>
      </div>
      <div className="text-right flex flex-col items-end">
        {isDeclined ? (
          <p className="text-xs text-muted-foreground">
            Declined all shifts
          </p>
        ) : (
          <>
            <div className="mb-1.5">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getBarColor()} transition-all`}
                  style={{
                    width: `${percent}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {shiftsCovered}/{totalShifts} remaining shifts
            </p>
          </>
        )}
      </div>
    </div>
  )
}

