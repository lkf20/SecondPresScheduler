import { AlertTriangle, Check, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CoverageBadgeType = 'covered' | 'partial' | 'uncovered'

interface CoverageBadgeProps {
  type: CoverageBadgeType
  count: number
  showLabel?: boolean
  className?: string
}

/**
 * Shared component for displaying coverage badges (Covered, Partial, Uncovered)
 * Standardizes colors and styling across the app
 */
export default function CoverageBadge({
  type,
  count,
  showLabel = true,
  className,
}: CoverageBadgeProps) {
  const baseClasses = 'inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 font-medium'

  switch (type) {
    case 'covered':
      return (
        <span
          className={cn(
            baseClasses,
            'bg-blue-50 border border-blue-400 text-blue-700',
            className
          )}
        >
          <Check className="h-3 w-3" />
          {showLabel && 'Covered: '}
          {count}
        </span>
      )

    case 'partial':
      return (
        <span
          className={cn(
            baseClasses,
            'bg-yellow-50 border border-yellow-300 text-yellow-700',
            className
          )}
        >
          <PieChart className="h-3 w-3" />
          {showLabel && 'Partial: '}
          {count}
        </span>
      )

    case 'uncovered':
      return (
        <span
          className={cn(
            baseClasses,
            'bg-orange-50 border border-orange-400 text-orange-700',
            className
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          {showLabel && 'Uncovered: '}
          {count}
        </span>
      )

    default:
      return null
  }
}
