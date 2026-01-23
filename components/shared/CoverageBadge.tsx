import { AlertTriangle, Check, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getCoverageColors,
  getCoverageColorClasses,
  coverageColorValues,
  type CoverageType,
} from '@/lib/utils/colors'

export type CoverageBadgeType = CoverageType

interface CoverageBadgeProps {
  type: CoverageBadgeType
  count: number
  showLabel?: boolean
  className?: string
}

/**
 * Shared component for displaying coverage badges (Covered, Partial, Uncovered)
 * Standardizes colors and styling across the app
 * Uses standardized color system from lib/utils/colors
 */
export default function CoverageBadge({
  type,
  count,
  showLabel = true,
  className,
}: CoverageBadgeProps) {
  const baseClasses =
    'inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 font-medium'
  const colors = getCoverageColors(type)

  switch (type) {
    case 'covered': {
      const colorClasses = getCoverageColorClasses('covered')
      const colorValues = coverageColorValues.covered
      return (
        <span
          className={cn(baseClasses, colorClasses, className)}
          style={
            {
              // Inline styles ensure colors override conflicting CSS (twMerge, specificity issues)
              backgroundColor: colorValues.bg,
              color: colorValues.text,
              borderStyle: 'solid',
              borderWidth: '1px',
              borderColor: colorValues.border,
            } as React.CSSProperties
          }
        >
          <Check className={cn('h-3 w-3', colors.icon)} />
          {showLabel && 'Covered: '}
          {count}
        </span>
      )
    }

    case 'partial': {
      const colorClasses = getCoverageColorClasses('partial')
      const colorValues = coverageColorValues.partial
      return (
        <span
          className={cn(baseClasses, colorClasses, className)}
          style={
            {
              backgroundColor: colorValues.bg,
              color: colorValues.text,
              borderStyle: 'solid',
              borderWidth: '1px',
              borderColor: colorValues.border,
            } as React.CSSProperties
          }
        >
          <PieChart className={cn('h-3 w-3', colors.icon)} />
          {showLabel && 'Partial: '}
          {count}
        </span>
      )
    }

    case 'uncovered': {
      const colorClasses = getCoverageColorClasses('uncovered')
      const colorValues = coverageColorValues.uncovered
      return (
        <span
          className={cn(baseClasses, colorClasses, className)}
          style={
            {
              backgroundColor: colorValues.bg,
              color: colorValues.text,
              borderStyle: 'solid',
              borderWidth: '1px',
              borderColor: colorValues.border,
            } as React.CSSProperties
          }
        >
          <AlertTriangle className={cn('h-3 w-3', colors.icon)} />
          {showLabel && 'Uncovered: '}
          {count}
        </span>
      )
    }

    default:
      return null
  }
}
