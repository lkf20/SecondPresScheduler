import { AlertTriangle, CheckCircle2, CircleDot, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStatusColorClasses, getStatusColors, getNeutralChipClasses } from '@/lib/utils/colors'

type CoverageStatus = 'draft' | 'completed' | 'covered' | 'partially_covered' | 'needs_coverage'

type CoverageStatusPillProps = {
  status: CoverageStatus
  coveredCount?: number
  totalCount?: number
  className?: string
}

const baseClass =
  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold'

export default function CoverageStatusPill({
  status,
  coveredCount,
  totalCount,
  className,
}: CoverageStatusPillProps) {
  switch (status) {
    case 'draft': {
      const colors = getStatusColors('draft')
      return (
        <span className={cn(baseClass, getStatusColorClasses('draft'), className)}>
          <CircleDot className={cn('h-3.5 w-3.5', colors.icon)} />
          Draft
        </span>
      )
    }
    case 'completed': {
      const colors = getStatusColors('completed')
      return (
        <span className={cn(baseClass, getStatusColorClasses('completed'), className)}>
          <CheckCircle2 className={cn('h-3.5 w-3.5', colors.icon)} />
          Completed
        </span>
      )
    }
    case 'covered': {
      const colors = getStatusColors('covered')
      return (
        <span className={cn(baseClass, getStatusColorClasses('covered'), className)}>
          <CheckCircle2 className={cn('h-3.5 w-3.5', colors.icon)} />
          Covered
        </span>
      )
    }
    case 'partially_covered': {
      const hasCounts = typeof coveredCount === 'number' && typeof totalCount === 'number'
      const colors = getStatusColors('partially_covered')
      return (
        <span
          className={cn(
            baseClass,
            getStatusColorClasses('partially_covered'),
            'border-dashed',
            className
          )}
        >
          <PieChart className={cn('h-3.5 w-3.5', colors.icon)} />
          Partially covered{hasCounts ? ` (${coveredCount} of ${totalCount})` : ''}
        </span>
      )
    }
    case 'needs_coverage': {
      const colors = getStatusColors('needs_coverage')
      return (
        <span className={cn(baseClass, getStatusColorClasses('needs_coverage'), className)}>
          <AlertTriangle className={cn('h-3.5 w-3.5', colors.icon)} />
          Needs coverage
        </span>
      )
    }
    default:
      return <span className={cn(baseClass, getNeutralChipClasses(), className)}>—</span>
  }
}
