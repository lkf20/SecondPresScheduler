'use client'

import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, Check, CheckCircle2, AlertTriangle, PieChart, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { parseLocalDate } from '@/lib/utils/date'
import { getClassroomPillStyle } from '@/lib/utils/classroom-style'

interface Absence {
  id: string
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  reason: string | null
  classrooms?: Array<{ id: string; name: string; color: string | null }>
  coverage_status?: 'uncovered' | 'partially_covered' | 'covered'
  coverage_badges?: Array<{
    label: string
    count: number
    tone: 'covered' | 'uncovered' | 'partial'
  }>
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
        const coverageStatus =
          absence.coverage_status ||
          (uncovered > 0 ? 'uncovered' : partially_covered > 0 ? 'partially_covered' : 'covered')
        const hasUncovered = coverageStatus === 'uncovered'
        const hasPartial = coverageStatus === 'partially_covered'
        const classrooms =
          absence.classrooms ||
          Array.from(
            new Set(
              absence.shifts.shift_details
                .map((shift) => shift.classroom_name)
                .filter((name): name is string => Boolean(name))
            )
          ).map((name) => ({ id: name, name, color: null }))
        const formatFullDateLabel = (value: string) => {
          const date = parseLocalDate(value)
          const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
          const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
          return `${weekday} ${dateLabel}`
        }
        const startDate = formatFullDateLabel(absence.start_date)
        const endDate =
          absence.end_date && absence.end_date !== absence.start_date
            ? formatFullDateLabel(absence.end_date)
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
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base text-slate-800">{absence.teacher_name}</h3>
                    {absence.reason && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {absence.reason}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-800">
                      {endDate ? `${startDate} - ${endDate}` : startDate}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {classrooms.map((classroom) => (
                      <span
                        key={classroom.id || classroom.name}
                        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                        style={getClassroomPillStyle(classroom.color)}
                      >
                        {classroom.name}
                      </span>
                    ))}
                    {classrooms.length === 0 && (
                      <span className="text-xs text-muted-foreground">Classroom unavailable</span>
                    )}
                  </div>
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

              <div className="mt-3 border-t border-slate-200 pt-3">
                {/* Shift Status Breakdown */}
                <div className="flex items-center justify-between gap-3">
                  {(absence.coverage_badges || []).length === 0 && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {fully_covered > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-blue-50 border border-blue-400 text-blue-700 font-medium">
                            <Check className="h-3 w-3" />
                            Covered: {fully_covered}
                          </span>
                        )}
                        {partially_covered > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-yellow-50 border border-yellow-300 text-yellow-700 font-medium">
                            Partial: {partially_covered}
                          </span>
                        )}
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        {uncovered > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 bg-amber-50 border border-amber-400 text-amber-700 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            Uncovered: {uncovered}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {(absence.coverage_badges || []).length > 0 && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {(absence.coverage_badges || [])
                          .filter((badge) => badge.tone !== 'uncovered')
                          .map((badge) => {
                            const palette =
                              badge.tone === 'covered'
                                ? {
                                    className: 'bg-blue-50 border border-blue-400 text-blue-700',
                                    icon: <Check className="h-3 w-3" />,
                                  }
                                : {
                                    className: 'bg-yellow-50 border border-yellow-300 text-yellow-700',
                                    icon: null,
                                  }

                            return (
                              <span
                                key={badge.label}
                                className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 font-medium ${palette.className}`}
                              >
                                {palette.icon}
                                {badge.label}: {badge.count}
                              </span>
                            )
                          })}
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        {(absence.coverage_badges || [])
                          .filter((badge) => badge.tone === 'uncovered')
                          .map((badge) => (
                            <span
                              key={badge.label}
                              className="inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-1 font-medium bg-amber-50 border border-amber-400 text-amber-700"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {badge.label}: {badge.count}
                            </span>
                          ))}
                      </div>
                    </>
                  )}
                </div>
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
