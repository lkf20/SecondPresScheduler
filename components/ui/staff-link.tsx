'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface StaffLinkProps {
  /** Staff member ID. When present, renders as Link to /staff/[id]. */
  staffId?: string
  /** Display name to show. */
  name: string
  /** Additional className (e.g. font-semibold). */
  className?: string
}

/**
 * Renders a staff name as plain text or as a link to the staff profile.
 * When staffId is present, renders as Link with hover:underline for discoverability.
 */
export default function StaffLink({ staffId, name, className }: StaffLinkProps) {
  if (staffId) {
    const link = (
      <Link
        href={`/staff/${staffId}`}
        className={cn('hover:underline cursor-pointer inline', className)}
        onClick={e => e.stopPropagation()}
      >
        {name}
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
  return <span className={className}>{name}</span>
}
