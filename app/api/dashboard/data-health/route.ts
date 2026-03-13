import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getTodayISO } from '@/lib/utils/date'

export async function GET() {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const today = getTodayISO()

    // Find all future coverage_request_shifts that are not cancelled
    const { data: shifts, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, day_of_week_id, time_slot_id, coverage_requests!inner(teacher_id)')
      .eq('school_id', schoolId)
      .gte('date', today)
      .neq('status', 'cancelled')

    if (shiftsError) throw shiftsError

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ orphanedShifts: [] })
    }

    // Find closures to check if any shifts fall on closed days
    const { data: closures, error: closuresError } = await supabase
      .from('school_closures')
      .select('date, time_slot_id')
      .eq('school_id', schoolId)
      .gte('date', today)

    if (closuresError) throw closuresError

    // Find baseline schedules for these teachers to check if they still match
    const teacherIds = [
      ...new Set(
        shifts.map(s => {
          const req = s.coverage_requests as unknown as { teacher_id: string }
          return req.teacher_id
        })
      ),
    ]
    const { data: baselineSchedules, error: baselineError } = await supabase
      .from('teacher_schedules')
      .select('teacher_id, day_of_week_id, time_slot_id')
      .eq('school_id', schoolId)
      .in('teacher_id', teacherIds)

    if (baselineError) throw baselineError

    const orphanedShifts = []

    for (const shift of shifts) {
      // 1. Check if it falls on a closed day
      const isClosed = closures?.some(
        c => c.date === shift.date && (!c.time_slot_id || c.time_slot_id === shift.time_slot_id)
      )

      // 2. Check if the baseline schedule still exists
      const req = shift.coverage_requests as unknown as { teacher_id: string }
      const hasBaseline = baselineSchedules?.some(
        b =>
          b.teacher_id === req.teacher_id &&
          b.day_of_week_id === shift.day_of_week_id &&
          b.time_slot_id === shift.time_slot_id
      )

      if (isClosed || !hasBaseline) {
        orphanedShifts.push({
          shift_id: shift.id,
          date: shift.date,
          reason: isClosed ? 'school_closed' : 'missing_baseline',
        })
      }
    }

    return NextResponse.json({ orphanedShifts })
  } catch (error) {
    console.error('Data health check failed:', error)
    return NextResponse.json({ error: 'Failed to run data health check' }, { status: 500 })
  }
}
