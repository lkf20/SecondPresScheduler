import { AlertTriangle, CheckCircle2, CircleDot, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    case 'draft':
      return (
        <span className={cn(baseClass, 'border-yellow-200 bg-yellow-50 text-yellow-700', className)}>
          <CircleDot className="h-3.5 w-3.5" />
          Draft
        </span>
      )
    case 'completed':
      return (
        <span className={cn(baseClass, 'border-green-200 bg-green-50 text-green-700', className)}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Completed
        </span>
      )
    case 'covered':
      return (
        <span className={cn(baseClass, 'border-green-200 bg-green-50 text-green-700', className)}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Covered
        </span>
      )
    case 'partially_covered': {
      const hasCounts = typeof coveredCount === 'number' && typeof totalCount === 'number'
      return (
        <span
          className={cn(
            baseClass,
            'border-amber-200 border-dashed bg-amber-50 text-amber-800',
            className
          )}
        >
          <PieChart className="h-3.5 w-3.5" />
          Partially covered{hasCounts ? ` (${coveredCount} of ${totalCount})` : ''}
        </span>
      )
    }
    case 'needs_coverage':
      return (
        <span
          className={cn(baseClass, 'border-amber-200 bg-amber-100 text-amber-900', className)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Needs coverage
        </span>
      )
    default:
      return (
        <span
          className={cn(
            baseClass,
            'border-slate-200 bg-slate-50 text-slate-600',
            className
          )}
        >
          —
        </span>
      )
  }
}
