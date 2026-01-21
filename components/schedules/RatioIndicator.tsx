'use client'

interface RatioIndicatorProps {
  required?: number
  preferred?: number
  assigned: number
}

export default function RatioIndicator({
  required,
  preferred,
  assigned,
}: RatioIndicatorProps) {
  if (!required && !preferred) {
    return null
  }

  const meetsRequired = required ? assigned >= required : true
  const meetsPreferred = preferred ? assigned >= preferred : true

  let statusColor = 'bg-gray-200 text-gray-700' // Default/gray
  let statusText = 'Unknown'

  if (meetsPreferred) {
    statusColor = 'bg-green-100 text-green-700'
    statusText = 'Preferred'
  } else if (meetsRequired) {
    statusColor = 'bg-yellow-100 text-yellow-700'
    statusText = 'Required'
  } else {
    statusColor = 'bg-red-100 text-red-700'
    statusText = 'Below Required'
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`px-1.5 py-0.5 rounded ${statusColor}`}>
        {statusText}
      </span>
      <span className="text-muted-foreground">
        {assigned}/{preferred || required || '?'} teachers
      </span>
    </div>
  )
}
