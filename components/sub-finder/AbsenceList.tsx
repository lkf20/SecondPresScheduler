'use client'

import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, AlertTriangle, PieChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { parseLocalDate } from '@/lib/utils/date'

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
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (absences.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <div className="rounded-full bg-gray-100 w-16 h-16 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="h-8 w-8 text-gray-400" />
        </div>
        <p className="mb-2 font-medium">No absences found</p>
        <p className="text-sm">All absences are fully covered or no time-off requests exist</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {absences.map((absence) => {
        const { uncovered, partially_covered, fully_covered } = absence.shifts
        const isSelected = selectedAbsence?.id === absence.id
        const hasUncovered = uncovered > 0
        const hasPartial = partially_covered > 0 || (fully_covered > 0 && uncovered > 0)
        const classrooms = Array.from(
          new Set(
            absence.shifts.shift_details
              .map((shift) => shift.classroom_name)
              .filter((name): name is string => Boolean(name))
          )
        )
        const classroomsLabel = classrooms.length > 0 ? classrooms.join(', ') : 'Classroom unavailable'
        const formatDate = (dateString: string) => {
          const date = parseLocalDate(dateString)
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const dayName = dayNames[date.getDay()]
          const month = monthNames[date.getMonth()]
          const day = date.getDate()
          return `${dayName} ${month} ${day}`
        }
        const startDate = formatDate(absence.start_date)
        const endDate =
          absence.end_date && absence.end_date !== absence.start_date
            ? formatDate(absence.end_date)
            : null

        return (
          <Card
            key={absence.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] border border-slate-200',
              isSelected && 'ring-1 ring-slate-300 shadow-md border-l-4 border-l-blue-500 animate-in fade-in-50 duration-200'
            )}
            onClick={() => {
              onSelectAbsence(absence)
              onFindSubs(absence)
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1 text-slate-800">{absence.teacher_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {endDate ? `${startDate} - ${endDate}` : startDate}
                    {absence.reason && (
                      <span className="italic"> ({absence.reason})</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{classroomsLabel}</p>
                </div>
                {hasUncovered && !hasPartial && (
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                )}
                {hasPartial && (
                  <PieChart className="h-5 w-5 text-amber-600 flex-shrink-0" />
                )}
                {!hasUncovered && !hasPartial && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                )}
              </div>

              {/* Shift Status Breakdown */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {fully_covered > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-blue-50 border border-blue-300 text-blue-700 font-medium">
                    <span
                      className="inline-block h-2 w-2 rounded-full border border-blue-700 flex-shrink-0"
                      style={{ backgroundColor: '#1d4ed8' }}
                    />
                    Covered: {fully_covered}
                  </span>
                )}

                {uncovered > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-700 font-medium">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                    Uncovered: {uncovered}
                  </span>
                )}

                {partially_covered > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-yellow-50 border border-yellow-300 text-yellow-700 font-medium">
                    <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                    Partial: {partially_covered}
                  </span>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-300 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={(event) => {
                    event.stopPropagation()
                    onFindSubs(absence)
                  }}
                  disabled={loading}
                >
                  Find Subs →
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
