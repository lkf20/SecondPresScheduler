'use client'

import { cn } from '@/lib/utils'

interface ActiveStatusChipProps {
  isActive: boolean
  className?: string
}

export default function ActiveStatusChip({ isActive, className }: ActiveStatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        className,
        isActive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'
      )}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
