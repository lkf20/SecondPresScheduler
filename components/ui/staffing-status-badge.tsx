'use client'

import type { StaffingStatus } from '@/lib/utils/colors'
import { staffingColorValues } from '@/lib/utils/colors'

export type StaffingStatusBadgeProps = {
  /** One of: below_required, below_preferred, adequate, above_target */
  status: StaffingStatus
  /** Label text (e.g. "Below Preferred by 1", "On Target") */
  label: string
  /** Size: sm = compact (header, inline list), md = slightly larger (dashboard cards) */
  size?: 'sm' | 'md'
  /** Use lighter border for below_preferred (default true) for a softer look */
  lighterBorderForPreferred?: boolean
  className?: string
}

/**
 * Shared staffing status badge. Use this anywhere we show Below Required,
 * Below Preferred, Above Target, or On Target badges to ensure consistency.
 *
 * @see docs/COLOR_CONSISTENCY_REVIEW.md
 * @see docs/UI_COLOR_STANDARDIZATION.md
 */
export function StaffingStatusBadge({
  status,
  label,
  size = 'sm',
  lighterBorderForPreferred = true,
  className = '',
}: StaffingStatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3.5 py-1 text-xs'
  const fontClass = size === 'sm' ? 'font-semibold' : 'font-medium'

  const style =
    status === 'below_required'
      ? {
          backgroundColor: staffingColorValues.below_required.bg,
          borderStyle: 'solid' as const,
          borderWidth: '1px',
          borderColor: staffingColorValues.below_required.border,
          color: staffingColorValues.below_required.text,
        }
      : status === 'below_preferred'
        ? {
            backgroundColor: staffingColorValues.below_preferred.bg,
            borderStyle: 'solid' as const,
            borderWidth: '1px',
            borderColor:
              lighterBorderForPreferred && 'borderLighter' in staffingColorValues.below_preferred
                ? (staffingColorValues.below_preferred as { borderLighter: string }).borderLighter
                : staffingColorValues.below_preferred.border,
            color: staffingColorValues.below_preferred.text,
          }
        : status === 'above_target'
          ? {
              backgroundColor: staffingColorValues.above_target.bg,
              borderStyle: 'solid' as const,
              borderWidth: '1px',
              borderColor: staffingColorValues.above_target.border,
              color: staffingColorValues.above_target.text,
            }
          : {
              // adequate
              backgroundColor: 'rgb(220, 252, 231)',
              borderStyle: 'solid' as const,
              borderWidth: '1px',
              borderColor: 'rgb(34, 197, 94)',
              color: 'rgb(22, 101, 52)',
            }

  return (
    <span
      className={`inline-flex items-center rounded-full whitespace-nowrap ${sizeClasses} ${fontClass} ${className}`}
      style={style}
    >
      {label}
    </span>
  )
}
