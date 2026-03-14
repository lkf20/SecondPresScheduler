import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getTodayISO, toDateStringISO } from '@/lib/utils/date'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'

export async function GET() {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const today = getTodayISO()

    // Find all future coverage_request_shifts that are not cancelled
    const { data: shiftsRaw, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select('id, date, day_of_week_id, time_slot_id, coverage_requests!inner(teacher_id, status)')
      .eq('school_id', schoolId)
      .gte('date', today)
      .neq('status', 'cancelled')

    if (shiftsError) throw shiftsError

    // Exclude shifts whose parent coverage_request is cancelled (defensive)
    const shifts = (shiftsRaw ?? []).filter(s => {
      const cr = s.coverage_requests as unknown as { status?: string }
      return cr?.status !== 'cancelled'
    })

    if (shifts.length === 0) {
      return NextResponse.json({ orphanedShifts: [] })
    }

    const teacherIds = [
      ...new Set(
        shifts.map(s => {
          const req = s.coverage_requests as unknown as { teacher_id: string }
          return req.teacher_id
        })
      ),
    ]

    // Fetch closures and baseline in parallel (both independent of each other)
    const [closuresResult, baselineResult] = await Promise.all([
      supabase
        .from('school_closures')
        .select('date, time_slot_id')
        .eq('school_id', schoolId)
        .gte('date', today),
      teacherIds.length > 0
        ? supabase
            .from('teacher_schedules')
            .select('teacher_id, day_of_week_id, time_slot_id')
            .eq('school_id', schoolId)
            .in('teacher_id', teacherIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (closuresResult.error) throw closuresResult.error
    if (baselineResult.error) throw baselineResult.error

    const closureList = closuresResult.data ?? []
    const baselineSchedules = baselineResult.data ?? []

    // O(1) baseline lookup: key = teacher_id|day_of_week_id|time_slot_id
    const baselineKey = (t: string, d: string | null, s: string) => `${t}|${d ?? ''}|${s}`
    const baselineSet = new Set(
      baselineSchedules.map(b => baselineKey(b.teacher_id, b.day_of_week_id, b.time_slot_id))
    )

    const orphanedShifts: Array<{ shift_id: string; date: string; reason: string }> = []

    for (const shift of shifts) {
      const dateNorm = toDateStringISO(shift.date)
      const isClosed = isSlotClosedOnDate(dateNorm, shift.time_slot_id, closureList)

      const req = shift.coverage_requests as unknown as { teacher_id: string }
      const hasBaseline = baselineSet.has(
        baselineKey(req.teacher_id, shift.day_of_week_id, shift.time_slot_id)
      )

      if (isClosed || !hasBaseline) {
        orphanedShifts.push({
          shift_id: shift.id,
          date: dateNorm || shift.date,
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
