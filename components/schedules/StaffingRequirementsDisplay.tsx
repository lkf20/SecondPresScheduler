'use client'

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

interface StaffingRequirementsDisplayProps {
  enrollment: number | null
  requiredRatio: number | null
  preferredRatio: number | null
  assignedCount: number
}

export default function StaffingRequirementsDisplay({
  enrollment,
  requiredRatio,
  preferredRatio,
  assignedCount,
}: StaffingRequirementsDisplayProps) {
  if (!enrollment || !requiredRatio) {
    return (
      <div className="space-y-3 rounded-md border p-4">
        <div className="text-sm font-medium">Staffing Status</div>
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Cannot compute staffing yet. Enrollment and class ratios are required.
        </div>
      </div>
    )
  }

  const requiredTeachers = Math.ceil(enrollment / requiredRatio)
  const preferredTeachers = preferredRatio ? Math.ceil(enrollment / preferredRatio) : null

  const meetsRequired = assignedCount >= requiredTeachers
  const meetsPreferred = preferredTeachers ? assignedCount >= preferredTeachers : meetsRequired

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="text-sm font-medium">Staffing Status</div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Required ratio:</span>
          <span className="font-medium">1:{requiredRatio}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Required teachers:</span>
          <span className="font-medium">{requiredTeachers}</span>
        </div>

        {preferredRatio && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Preferred ratio:</span>
              <span className="font-medium">1:{preferredRatio}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Preferred teachers:</span>
              <span className="font-medium">{preferredTeachers}</span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          {meetsRequired ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span
            className={`text-sm font-medium ${meetsRequired ? 'text-green-600' : 'text-red-600'}`}
          >
            {meetsRequired
              ? 'Meets required'
              : `Does not meet required (${assignedCount}/${requiredTeachers})`}
          </span>
        </div>
        {preferredRatio && (
          <div className="flex items-center gap-2">
            {meetsPreferred ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            <span
              className={`text-sm font-medium ${meetsPreferred ? 'text-green-600' : 'text-yellow-600'}`}
            >
              {meetsPreferred
                ? 'Meets preferred'
                : `Does not meet preferred (${assignedCount}/${preferredTeachers})`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
