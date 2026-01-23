'use client'

import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import TimeOffCard from '@/components/shared/TimeOffCard'
import type { ClassroomBadge } from '@/components/shared/TimeOffCard'

interface Absence {
  id: string
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string | null
  reason: string | null
  notes?: string | null
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
        {[1, 2, 3].map(i => (
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
        <div className="rounded-full bg-slate-100 w-16 h-16 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <p className="mb-2 font-medium">No absences found</p>
        <p className="text-sm">All absences are fully covered or no time-off requests exist</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {absences.map(absence => {
        const { uncovered, partially_covered, fully_covered } = absence.shifts
        const isSelected = selectedAbsence?.id === absence.id

        // Map classrooms from absence.classrooms or derive from shift_details
        const classrooms: ClassroomBadge[] =
          absence.classrooms ||
          Array.from(
            new Set(
              absence.shifts.shift_details
                .map(shift => shift.classroom_name)
                .filter((name): name is string => Boolean(name))
            )
          ).map(name => ({ id: name, name, color: null }))

        return (
          <TimeOffCard
            key={absence.id}
            id={absence.id}
            teacherName={absence.teacher_name}
            startDate={absence.start_date}
            endDate={absence.end_date}
            reason={absence.reason}
            classrooms={classrooms}
            variant="sub-finder"
            covered={fully_covered}
            uncovered={uncovered}
            partial={partially_covered}
            isSelected={isSelected}
            onSelect={() => {
              onSelectAbsence(absence)
              onFindSubs(absence)
            }}
            onFindSubs={() => onFindSubs(absence)}
            loading={loading}
            notes={absence.notes || null}
          />
        )
      })}
    </div>
  )
}
