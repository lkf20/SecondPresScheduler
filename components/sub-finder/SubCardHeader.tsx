'use client'

import { type ReactNode } from 'react'
import { Phone, Mail } from 'lucide-react'
import { shiftStatusColorValues } from '@/lib/utils/colors'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'

interface SubCardHeaderProps {
  name: string
  phone: string | null
  email?: string | null
  statusLine?: ReactNode
  statusBadge?: {
    label: string
    icon: LucideIcon
    className: string
  } | null
  shiftsCovered: number
  totalShifts: number
  isDeclined?: boolean
  showCoverage?: boolean
  compactSpacing?: boolean
}

export default function SubCardHeader({
  name,
  phone,
  email = null,
  statusLine,
  statusBadge = null,
  shiftsCovered,
  totalShifts,
  isDeclined = false,
  showCoverage = true,
  compactSpacing = false,
}: SubCardHeaderProps) {
  const coveredSegments = Math.min(shiftsCovered, totalShifts)

  return (
    <div
      className={
        compactSpacing
          ? 'flex items-start justify-between mb-1'
          : 'flex items-start justify-between mb-3'
      }
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {statusBadge && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${statusBadge.className}`}
                  >
                    <statusBadge.icon className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{statusBadge.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <h3 className="font-semibold text-base">{name}</h3>
        </div>
        {(phone || email) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                <span>{phone}</span>
              </span>
            )}
            {phone && email && <span>·</span>}
            {email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                <span>{email}</span>
              </span>
            )}
          </div>
        )}
        {statusLine && <div className="mt-1 text-xs leading-snug text-slate-500">{statusLine}</div>}
      </div>
      {showCoverage && (
        <div className="text-right flex flex-col items-end">
          {isDeclined ? (
            <p className="text-xs text-muted-foreground">Declined all shifts</p>
          ) : (
            <>
              <div className="mb-1.5">
                <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
                  {totalShifts === 0 ? (
                    <div
                      className="h-full w-[14px] rounded border"
                      style={{
                        backgroundColor: shiftStatusColorValues.unavailable.border,
                        borderColor: shiftStatusColorValues.unavailable.border,
                      }}
                    />
                  ) : (
                    Array.from({ length: totalShifts }).map((_, index) => {
                      const colors =
                        index < coveredSegments
                          ? shiftStatusColorValues.available
                          : shiftStatusColorValues.unavailable
                      return (
                        <div
                          key={`segment-${index}`}
                          className="h-full rounded border"
                          style={{
                            width: '14px',
                            backgroundColor: colors.border,
                            borderColor: colors.border,
                          }}
                        />
                      )
                    })
                  )}
                </div>
              </div>
              <p className="text-xs text-teal-600">
                {shiftsCovered}/{totalShifts} remaining shifts
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
