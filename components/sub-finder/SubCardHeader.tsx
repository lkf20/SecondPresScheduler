'use client'

import { User, Phone } from 'lucide-react'

interface SubCardHeaderProps {
  name: string
  phone: string | null
  shiftsCovered: number
  totalShifts: number
  isDeclined?: boolean
}

export default function SubCardHeader({
  name,
  phone,
  shiftsCovered,
  totalShifts,
  isDeclined = false,
}: SubCardHeaderProps) {
  const coveredSegments = Math.min(shiftsCovered, totalShifts)

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
              <div className="h-2 min-w-[64px] rounded-full overflow-hidden flex gap-0.5">
                {totalShifts === 0 ? (
                  <div
                    className="h-full w-[14px] rounded border"
                    style={{
                      backgroundColor: '#d1d5db',
                      borderColor: '#d1d5db',
                    }}
                  />
                ) : (
                  Array.from({ length: totalShifts }).map((_, index) => {
                    const colors =
                      index < coveredSegments
                        ? { backgroundColor: '#a7f3d0', borderColor: '#a7f3d0' }
                        : { backgroundColor: '#d1d5db', borderColor: '#d1d5db' }
                    return (
                      <div
                        key={`segment-${index}`}
                        className="h-full rounded border"
                        style={{
                          width: '14px',
                          ...colors,
                        }}
                      />
                    )
                  })
                )}
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
