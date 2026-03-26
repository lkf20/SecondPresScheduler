'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { adminRoleColorValues } from '@/lib/utils/colors'

export type StaffChipVariant =
  | 'absent'
  | 'reassigned'
  | 'sub'
  | 'permanent'
  | 'flex'
  | 'floater'
  | 'tempCoverage'
  | 'breakCoverage'
  | 'admin'

export interface StaffChipProps {
  /** Staff member ID. When present and navigable, chip links to /staff/[id]. */
  staffId?: string
  /** Display name. */
  name: string
  /** Visual variant (colors, border). */
  variant: StaffChipVariant
  /** When true (default) and staffId present, chip is a link. When false, chip is plain span. */
  navigable?: boolean
  /** Optional suffix (e.g. break time range "☕ 11:00 – 11:30") rendered after the name. */
  suffix?: React.ReactNode
  /** Optional title for the chip. */
  title?: string
}

const VARIANT_CLASSES: Record<StaffChipVariant, string> = {
  absent: 'bg-gray-100 text-gray-700 border border-gray-300',
  reassigned: 'bg-gray-200 text-gray-700 border border-gray-400',
  sub: 'bg-teal-50 text-teal-600 border border-teal-200',
  permanent: 'bg-blue-100 text-blue-800 border border-blue-300',
  flex: 'bg-blue-50 text-blue-800 border border-blue-500 border-dashed',
  floater: 'bg-purple-100 text-purple-800 border border-purple-300 border-dashed',
  tempCoverage: 'bg-[#fdf2f8] text-pink-700 border border-[#f9a8d4] border-dashed',
  breakCoverage: 'bg-indigo-50 text-indigo-700 border border-indigo-300 border-dashed',
  admin: 'border',
}

const VARIANT_STYLES: Partial<Record<StaffChipVariant, React.CSSProperties>> = {
  flex: { borderColor: '#3b82f6' },
  permanent: { borderColor: '#93c5fd' },
  tempCoverage: {
    borderColor: '#f9a8d4',
    backgroundColor: '#fdf2f8',
    color: '#db2777',
  },
  breakCoverage: {
    borderColor: '#a5b4fc',
    backgroundColor: '#eef2ff',
    color: '#4338ca',
  },
  admin: {
    backgroundColor: adminRoleColorValues.bg,
    borderColor: adminRoleColorValues.border,
    color: adminRoleColorValues.text,
  },
}

const baseChipClasses =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit'

export default function StaffChip({
  staffId,
  name,
  variant,
  navigable = true,
  suffix,
  title,
}: StaffChipProps) {
  const chipContent = (
    <>
      <span>{name}</span>
      {suffix && (
        <span className="ml-1 inline-flex items-center text-[10px] opacity-80 whitespace-nowrap">
          {suffix}
        </span>
      )}
    </>
  )

  const chipClasses = cn(baseChipClasses, VARIANT_CLASSES[variant])
  const chipStyle = VARIANT_STYLES[variant]

  const chipElement = (
    <span
      className={cn(chipClasses, navigable && staffId && 'cursor-pointer hover:opacity-90')}
      title={title}
      style={chipStyle}
    >
      {chipContent}
    </span>
  )

  if (navigable && staffId) {
    const link = (
      <Link
        href={`/staff/${staffId}`}
        onClick={e => e.stopPropagation()}
        className="inline-flex w-fit shrink-0 max-w-full"
      >
        {chipElement}
      </Link>
    )
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent>
            <p>Go to staff profile</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return chipElement
}
