'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Absence {
  id: string
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  reason: string | null
  shifts: {
    total: number
    uncovered: number
    partially_covered: number
    fully_covered: number
    shift_details: Array<{
      id: string
      date: string
      day_name: string
      time_slot_code: string
      class_name: string | null
      classroom_name: string | null
      status: 'uncovered' | 'partially_covered' | 'fully_covered'
    }>
  }
}

interface AbsenceListProps {
  absences: Absence[]
  selectedAbsence: Absence | null
  onSelectAbsence: (absence: Absence) => void
  onFindSubs: (absence: Absence) => void
  loading: boolean
}

export default function AbsenceList({
  absences,
  selectedAbsence,
  onSelectAbsence,
  onFindSubs,
  loading,
}: AbsenceListProps) {
  if (loading && absences.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading absences...
      </div>
    )
  }

  if (absences.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="mb-2">No absences found</p>
        <p className="text-sm">All absences are fully covered or no time-off requests exist</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {absences.map((absence) => {
        const { uncovered, partially_covered, fully_covered, total } = absence.shifts
        const isSelected = selectedAbsence?.id === absence.id
        const hasUncovered = uncovered > 0
        const hasPartial = partially_covered > 0

        return (
          <Card
            key={absence.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              isSelected && 'ring-2 ring-primary'
            )}
            onClick={() => onSelectAbsence(absence)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">{absence.teacher_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(absence.start_date).toLocaleDateString()}
                    {absence.end_date && 
                      ` - ${new Date(absence.end_date).toLocaleDateString()}`
                    }
                  </p>
                  {absence.reason && (
                    <p className="text-xs text-muted-foreground mt-1">{absence.reason}</p>
                  )}
                </div>
                {hasUncovered && (
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                )}
                {!hasUncovered && hasPartial && (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                )}
                {!hasUncovered && !hasPartial && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                )}
              </div>

              {/* Shift Status Breakdown */}
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total shifts:</span>
                  <span className="font-medium">{total}</span>
                </div>
                
                {uncovered > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="text-muted-foreground">Uncovered:</span>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {uncovered}
                    </Badge>
                  </div>
                )}

                {partially_covered > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-yellow-600" />
                      <span className="text-muted-foreground">Partially covered:</span>
                    </div>
                    <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-700">
                      {partially_covered}
                    </Badge>
                  </div>
                )}

                {fully_covered > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-600" />
                      <span className="text-muted-foreground">Fully covered:</span>
                    </div>
                    <Badge variant="outline" className="text-xs border-green-600 text-green-700">
                      {fully_covered}
                    </Badge>
                  </div>
                )}
              </div>

              <Button
                size="sm"
                className="w-full mt-3"
                onClick={(e) => {
                  e.stopPropagation()
                  onFindSubs(absence)
                }}
                disabled={loading}
              >
                Find Subs
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

