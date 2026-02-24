'use client'

interface ActiveStatusChipProps {
  isActive: boolean
}

export default function ActiveStatusChip({ isActive }: ActiveStatusChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        isActive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
