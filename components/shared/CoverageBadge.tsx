import { AlertTriangle, Check, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCoverageColors, getCoverageColorClasses, type CoverageType } from '@/lib/utils/colors'

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
  const baseClasses = 'inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 font-medium'
  const colors = getCoverageColors(type)

  switch (type) {
    case 'covered':
      return (
        <span
          className={cn(
            baseClasses,
            getCoverageColorClasses('covered'),
            className
          )}
        >
          <Check className={cn('h-3 w-3', colors.icon)} />
          {showLabel && 'Covered: '}
          {count}
        </span>
      )

    case 'partial':
      return (
        <span
          className={cn(
            baseClasses,
            getCoverageColorClasses('partial'),
            className
          )}
        >
          <PieChart className={cn('h-3 w-3', colors.icon)} />
          {showLabel && 'Partial: '}
          {count}
        </span>
      )

    case 'uncovered':
      return (
        <span
          className={cn(
            baseClasses,
            getCoverageColorClasses('uncovered'),
            className
          )}
        >
          <AlertTriangle className={cn('h-3 w-3', colors.icon)} />
          {showLabel && 'Uncovered: '}
          {count}
        </span>
      )

    default:
      return null
  }
}
