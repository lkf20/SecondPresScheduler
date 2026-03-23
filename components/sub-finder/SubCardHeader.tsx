'use client'

import { type ReactNode } from 'react'
import { CheckCircle, Mail } from 'lucide-react'
import { formatUSPhone } from '@/lib/utils/phone'
import { shiftStatusColorValues } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'

interface SubCardHeaderProps {
  name: string
  phone: string | null
  email?: string | null
  statusLine?: ReactNode
  belowContact?: ReactNode
  statusBadge?: {
    label: string
    icon: LucideIcon
    className: string
  } | null
  shiftsCovered: number
  totalShifts: number
  isDeclined?: boolean
  showCoverage?: boolean
  /** When true, show coverage as a badge in the right column (e.g. "57% Match") instead of the bar */
  showCoverageBadge?: boolean
  /** Optional content to show in the upper right (e.g. availability strip), to the right of the badge */
  rightContent?: ReactNode
  /** When true, do not show phone/email below the name (e.g. when shown at bottom of card) */
  hideContactInHeader?: boolean
  compactSpacing?: boolean
  /** When true, use smaller match badge and status badge (e.g. right panel All Subs cards) */
  compactBadge?: boolean
}

export default function SubCardHeader({
  name,
  phone,
  email = null,
  statusLine,
  belowContact = null,
  statusBadge = null,
  shiftsCovered,
  totalShifts,
  isDeclined = false,
  showCoverage = true,
  showCoverageBadge = false,
  rightContent = null,
  hideContactInHeader = false,
  compactSpacing = false,
  compactBadge = false,
}: SubCardHeaderProps) {
  const coveredSegments = Math.min(shiftsCovered, totalShifts)
  const showBadge = showCoverageBadge && !isDeclined && totalShifts > 0
  const matchPercent =
    totalShifts > 0 ? Math.min(100, Math.round((shiftsCovered / totalShifts) * 100)) : 0
  return (
    <div
      className={
        compactSpacing
          ? 'flex items-start justify-between mb-1'
          : 'flex items-start justify-between mb-3'
      }
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-nowrap">
          {statusBadge && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center justify-center rounded-full border',
                      compactBadge ? 'h-5 w-5' : 'h-7 w-7',
                      statusBadge.className
                    )}
                  >
                    <statusBadge.icon className={compactBadge ? 'h-3 w-3' : 'h-4 w-4'} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{statusBadge.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-xl">{name}</h3>
              {statusLine && (
                <>
                  <span className="text-slate-400" aria-hidden>
                    ·
                  </span>
                  {statusLine}
                </>
              )}
              {showBadge && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full border font-medium tabular-nums',
                          compactBadge ? 'px-2 py-0.5 text-xs' : 'gap-1.5 px-2.5 py-1 text-sm',
                          matchPercent !== 100 && 'bg-amber-50'
                        )}
                        style={
                          matchPercent === 100
                            ? {
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                // Match ShiftChips soft available (Can cover) colors exactly
                                borderColor: 'rgb(196, 234, 226)',
                                backgroundColor: 'rgb(246, 253, 251)',
                                color: 'rgb(15, 118, 110)',
                              }
                            : { borderColor: 'rgba(180, 83, 9, 0.25)', color: 'rgb(180, 83, 9)' }
                        }
                        aria-label={`Available for ${shiftsCovered} of ${totalShifts} remaining shifts`}
                      >
                        {matchPercent === 100 ? (
                          <CheckCircle
                            className={compactBadge ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'}
                            style={{ color: 'rgb(15, 118, 110)' }}
                            aria-hidden
                          />
                        ) : (
                          <CheckCircle
                            className={
                              compactBadge
                                ? 'h-3 w-3 shrink-0 text-amber-500'
                                : 'h-3.5 w-3.5 shrink-0 text-amber-500'
                            }
                            aria-hidden
                          />
                        )}
                        {matchPercent}% match
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Available for {shiftsCovered} of {totalShifts} remaining shifts
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {!hideContactInHeader && (phone || email) && (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-base text-muted-foreground">
                {phone && <span>{formatUSPhone(phone)}</span>}
                {phone && email && <span aria-hidden>·</span>}
                {email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>{email}</span>
                  </span>
                )}
              </div>
            )}
            {belowContact && <div className="mt-1.5">{belowContact}</div>}
          </div>
        </div>
      </div>
      {(rightContent || (showCoverage && !showCoverageBadge)) && (
        <div className="flex items-center gap-2 shrink-0">
          {rightContent}
          {showCoverage && !showCoverageBadge && (
            <div className="text-right flex flex-col items-end">
              {isDeclined ? (
                <p className="text-xs text-muted-foreground">Declined all shifts</p>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="cursor-help"
                        aria-label={`Available for ${shiftsCovered} of ${totalShifts} remaining shifts`}
                      >
                        <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
                          {totalShifts === 0 ? (
                            <div
                              className="h-full w-[14px] rounded border"
                              style={{
                                backgroundColor: 'rgb(253, 218, 185)',
                                borderColor: 'rgb(253, 218, 185)',
                              }}
                            />
                          ) : (
                            Array.from({ length: totalShifts }).map((_, index) => {
                              const colors =
                                index < coveredSegments
                                  ? shiftStatusColorValues.available
                                  : { border: 'rgb(253, 218, 185)' } // light orange (softer than uncovered text)
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
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Available for {shiftsCovered} of {totalShifts} remaining shifts
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
