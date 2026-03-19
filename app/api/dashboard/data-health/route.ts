import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getTodayISO, toDateStringISO } from '@/lib/utils/date'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'

export async function GET() {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const today = getTodayISO()

    // Find all future coverage_request_shifts that are not cancelled (shift row and parent coverage_request)
    const { data: shiftsRaw, error: shiftsError } = await supabase
      .from('coverage_request_shifts')
      .select(
        `
        id,
        date,
        day_of_week_id,
        time_slot_id,
        day_of_week:days_of_week(name),
        time_slot:time_slots(code),
        coverage_requests!inner(
          teacher_id,
          status,
          teacher:staff!coverage_requests_teacher_id_fkey(first_name, last_name, display_name)
        )
      `
      )
      .eq('school_id', schoolId)
      .gte('date', today)
      .neq('status', 'cancelled')
      .neq('coverage_requests.status', 'cancelled')

    if (shiftsError) throw shiftsError

    // Defensive: exclude any shift whose parent coverage_request is cancelled (e.g. if filter syntax varies)
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
            .select('teacher_id, day_of_week_id, time_slot_id, classroom_id')
            .eq('school_id', schoolId)
            .in('teacher_id', teacherIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (closuresResult.error) throw closuresResult.error
    if (baselineResult.error) throw baselineResult.error

    const closureList = closuresResult.data ?? []
    const baselineSchedules = baselineResult.data ?? []

    // O(1) baseline lookup: key = teacher_id|day_of_week_id|time_slot_id
    // Only count as "has baseline" when the row has a non-null classroom_id (matches
    // coverage-request creation, which omits shifts where teacher_schedules.classroom_id is null).
    const baselineKey = (t: string, d: string | null, s: string) => `${t}|${d ?? ''}|${s}`
    const baselineSet = new Set(
      baselineSchedules
        .filter((b: { classroom_id?: string | null }) => b.classroom_id != null)
        .map(b => baselineKey(b.teacher_id, b.day_of_week_id, b.time_slot_id))
    )

    const orphanedShifts: Array<{
      shift_id: string
      date: string
      reason: string
      teacher_name: string | null
      day_name: string | null
      time_slot_code: string | null
    }> = []

    for (const shift of shifts) {
      const dateNorm = toDateStringISO(shift.date)
      const isClosed = isSlotClosedOnDate(dateNorm, shift.time_slot_id, closureList)

      const req = shift.coverage_requests as unknown as { teacher_id: string }
      const hasBaseline = baselineSet.has(
        baselineKey(req.teacher_id, shift.day_of_week_id, shift.time_slot_id)
      )

      if (isClosed || !hasBaseline) {
        const teacherName = (() => {
          const teacher = (shift.coverage_requests as any)?.teacher
          if (!teacher) return null
          return getStaffDisplayName(teacher) || null
        })()
        const dayName = ((shift as any).day_of_week as { name?: string } | null)?.name ?? null
        const timeSlotCode =
          ((shift as any).time_slot as { code?: string } | null)?.code ?? null

        orphanedShifts.push({
          shift_id: shift.id,
          date: dateNorm || shift.date,
          reason: isClosed ? 'school_closed' : 'missing_baseline',
          teacher_name: teacherName,
          day_name: dayName,
          time_slot_code: timeSlotCode,
        })
      }
    }

    return NextResponse.json({ orphanedShifts })
  } catch (error) {
    console.error('Data health check failed:', error)
    return NextResponse.json({ error: 'Failed to run data health check' }, { status: 500 })
  }
}
