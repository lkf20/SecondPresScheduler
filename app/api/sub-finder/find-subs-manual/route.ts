import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSubs } from '@/lib/api/subs'
import { getSubAvailability, getSubAvailabilityExceptions } from '@/lib/api/sub-availability'
import { getTeacherScheduledShifts, getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { createErrorResponse } from '@/lib/utils/errors'
import { toDateStringISO } from '@/lib/utils/date'
import { getUserSchoolId } from '@/lib/utils/auth'
import { findTopCombinations } from '@/lib/utils/sub-combination'
import { buildShiftChips } from '@/lib/server/coverage/shift-chips'
import { sortShiftDetailsByDisplayOrder } from '@/lib/utils/shift-display-order'
import { deriveShiftCoverageStatus } from '@/lib/schedules/coverage-weights'

interface ManualShiftInput {
  date: string
  day_of_week_id: string
  time_slot_id: string
}

interface ShiftDetail {
  id: string
  date: string
  day_name: string
  time_slot_code: string
  class_name: string | null
  classroom_name: string | null
  status: 'uncovered' | 'partially_covered' | 'fully_covered'
  sub_name?: string | null
  sub_names?: string[]
  is_partial?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { teacher_id, start_date, end_date, shifts } = body as {
      teacher_id?: string
      start_date?: string
      end_date?: string
      shifts?: ManualShiftInput[]
    }

    if (!teacher_id || !start_date || !end_date || !Array.isArray(shifts)) {
      return NextResponse.json(
        { error: 'teacher_id, start_date, end_date, and shifts are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    if (shifts.length === 0) {
      return NextResponse.json({
        subs: [],
        shift_details: [],
        totals: { total: 0, uncovered: 0, partially_covered: 0, fully_covered: 0 },
      })
    }

    const uniqueDayIds = Array.from(new Set(shifts.map(shift => shift.day_of_week_id)))
    const uniqueSlotIds = Array.from(new Set(shifts.map(shift => shift.time_slot_id)))

    const [{ data: days }, { data: slots }] = await Promise.all([
      supabase.from('days_of_week').select('id, name, display_order').in('id', uniqueDayIds),
      supabase.from('time_slots').select('id, code, display_order').in('id', uniqueSlotIds),
    ])

    const dayNameMap = new Map<string, string>()
    const dayDisplayOrderMap = new Map<string, number>()
    ;(days || []).forEach((day: any) => {
      dayNameMap.set(day.id, day.name || '')
      dayDisplayOrderMap.set(day.id, day.display_order ?? 999)
    })

    const slotCodeMap = new Map<string, string>()
    const slotDisplayOrderMap = new Map<string, number>()
    ;(slots || []).forEach((slot: any) => {
      slotCodeMap.set(slot.id, slot.code || '')
      slotDisplayOrderMap.set(slot.id, slot.display_order ?? 999)
    })

    const { data: teacherSchedules, error: scheduleError } = await supabase
      .from('teacher_schedules')
      .select('day_of_week_id, time_slot_id, classroom:classrooms(name)')
      .eq('teacher_id', teacher_id)

    if (scheduleError) {
      console.error('Error fetching teacher schedules:', scheduleError)
    }

    const scheduleLookup = new Map<string, { classrooms: Set<string>; classes: Set<string> }>()
    ;(teacherSchedules || []).forEach((schedule: any) => {
      const key = `${schedule.day_of_week_id}|${schedule.time_slot_id}`
      const entry = scheduleLookup.get(key) || {
        classrooms: new Set<string>(),
        classes: new Set<string>(),
      }
      if (schedule.classroom?.name) entry.classrooms.add(schedule.classroom.name)
      // Note: class groups are no longer directly on teacher_schedules
      scheduleLookup.set(key, entry)
    })

    const { data: subAssignments, error: subError } = await supabase
      .from('sub_assignments')
      .select(
        `
        date,
        time_slot_id,
        is_partial,
        assignment_type,
        sub:staff!sub_assignments_sub_id_fkey(first_name, last_name, display_name)
      `
      )
      .eq('teacher_id', teacher_id)
      .gte('date', start_date)
      .lte('date', end_date)

    if (subError) {
      console.error('Error fetching sub assignments:', subError)
    }

    // Multi-value map: key -> array of assignment entries (handles multiple partials)
    const assignmentMap = new Map<string, Array<{ sub_name: string; is_partial: boolean }>>()

    shifts.forEach(shift => {
      const key = `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
      assignmentMap.set(key, [])
    })
    ;(subAssignments || []).forEach((assignment: any) => {
      const key = `${toDateStringISO(assignment.date)}|${assignment.time_slot_id}`
      if (!assignmentMap.has(key)) return
      const sub = assignment.sub as any
      const sub_name =
        sub?.display_name ||
        (sub?.first_name && sub?.last_name ? `${sub.first_name} ${sub.last_name}` : 'Unknown Sub')
      const isPartial =
        assignment.is_partial === true || assignment.assignment_type === 'Partial Sub Shift'
      assignmentMap.get(key)!.push({ sub_name, is_partial: isPartial })
    })

    // Derive coverage status using the centralized helper
    const coverageMap = new Map<string, 'uncovered' | 'partially_covered' | 'fully_covered'>()
    for (const [key, entries] of assignmentMap) {
      coverageMap.set(
        key,
        deriveShiftCoverageStatus({ assignments: entries.map(e => ({ is_partial: e.is_partial })) })
      )
    }

    const shiftDetails: ShiftDetail[] = shifts.map(shift => {
      const key = `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
      const status = coverageMap.get(key) || 'uncovered'
      const entries = assignmentMap.get(key) ?? []
      const scheduleKey = `${shift.day_of_week_id}|${shift.time_slot_id}`
      const scheduleEntry = scheduleLookup.get(scheduleKey)
      const classroom_name = scheduleEntry?.classrooms?.size
        ? Array.from(scheduleEntry.classrooms).join(', ')
        : null
      const class_name = scheduleEntry?.classes?.size
        ? Array.from(scheduleEntry.classes).join(', ')
        : null

      // For display: comma-join multiple sub names
      const sub_name = entries.length > 0 ? entries.map(e => e.sub_name).join(', ') : null
      const is_partial = entries.length > 0 && entries.every(e => e.is_partial)

      return {
        id: `${shift.date}-${shift.time_slot_id}`,
        date: shift.date,
        day_name: dayNameMap.get(shift.day_of_week_id) || '',
        time_slot_code: slotCodeMap.get(shift.time_slot_id) || '',
        class_name,
        classroom_name,
        status,
        sub_name,
        sub_names: entries.map(e => e.sub_name),
        is_partial,
        day_display_order: dayDisplayOrderMap.get(shift.day_of_week_id) ?? null,
        time_slot_display_order: slotDisplayOrderMap.get(shift.time_slot_id) ?? null,
      }
    })

    const sortedShiftDetails = sortShiftDetailsByDisplayOrder(shiftDetails)

    const uncovered = sortedShiftDetails.filter(s => s.status === 'uncovered').length
    const partially_covered = sortedShiftDetails.filter(
      s => s.status === 'partially_covered'
    ).length
    const fully_covered = sortedShiftDetails.filter(s => s.status === 'fully_covered').length
    const total = sortedShiftDetails.length

    const allSubs = await getSubs()
    const activeSubs = allSubs.filter(sub => sub.active !== false)

    const conflictingTimeOffRequests = await getTimeOffRequests({
      school_id: schoolId,
      start_date,
      end_date,
    })

    const timeOffByTeacher = new Map<string, any[]>()
    conflictingTimeOffRequests.forEach((req: any) => {
      if (!timeOffByTeacher.has(req.teacher_id)) {
        timeOffByTeacher.set(req.teacher_id, [])
      }
      timeOffByTeacher.get(req.teacher_id)!.push(req)
    })

    const subMatches = await Promise.all(
      activeSubs.map(async sub => {
        const availability = await getSubAvailability(sub.id)
        const availabilityExceptions = await getSubAvailabilityExceptions(sub.id, {
          start_date,
          end_date,
        })

        const availabilityMap = new Map<string, boolean>()
        availability.forEach((avail: any) => {
          if (avail.available) {
            const key = `${avail.day_of_week_id}|${avail.time_slot_id}`
            availabilityMap.set(key, true)
          }
        })

        availabilityExceptions.forEach((exception: any) => {
          const key = `${toDateStringISO(exception.date)}|${exception.time_slot_id}`
          availabilityMap.set(key, exception.available)
        })

        const subScheduledShifts = await getTeacherScheduledShifts(sub.id, start_date, end_date)
        const scheduleConflicts = new Set<string>()
        subScheduledShifts.forEach(scheduledShift => {
          const key = `${toDateStringISO(scheduledShift.date)}|${scheduledShift.time_slot_id}`
          scheduleConflicts.add(key)
        })

        const subTimeOffRequests = timeOffByTeacher.get(sub.id) || []
        const timeOffConflicts = new Set<string>()
        for (const req of subTimeOffRequests) {
          try {
            const reqShifts = await getTimeOffShifts(req.id)
            reqShifts.forEach((shift: any) => {
              const key = `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
              timeOffConflicts.add(key)
            })
          } catch (error) {
            console.error(`Error fetching shifts for time off request ${req.id}:`, error)
          }
        }

        const subCapabilities = {
          can_change_diapers: sub.can_change_diapers ?? false,
          can_lift_children: sub.can_lift_children ?? false,
        }

        let availableShifts = 0
        const canCover: Array<any> = []
        const cannotCover: Array<any> = []

        shifts.forEach(shift => {
          const availabilityKey = `${shift.day_of_week_id}|${shift.time_slot_id}`
          const conflictKey = `${toDateStringISO(shift.date)}|${shift.time_slot_id}`
          const isAvailable = availabilityMap.has(availabilityKey)
            ? availabilityMap.get(availabilityKey)!
            : false
          const hasScheduleConflict = scheduleConflicts.has(conflictKey)
          const hasTimeOffConflict = timeOffConflicts.has(conflictKey)

          // ManualShiftInput omits class IDs; class group details come from schedule lookup.

          const timeSlotCode = slotCodeMap.get(shift.time_slot_id) || ''
          const dayName = dayNameMap.get(shift.day_of_week_id) || ''
          const scheduleEntry = scheduleLookup.get(`${shift.day_of_week_id}|${shift.time_slot_id}`)
          const classroom_name = scheduleEntry?.classrooms?.size
            ? Array.from(scheduleEntry.classrooms).join(', ')
            : null
          const class_name = scheduleEntry?.classes?.size
            ? Array.from(scheduleEntry.classes).join(', ')
            : null

          if (isAvailable && !hasScheduleConflict && !hasTimeOffConflict) {
            availableShifts++
            canCover.push({
              date: shift.date,
              day_name: dayName,
              time_slot_code: timeSlotCode,
              class_name,
              classroom_name,
              diaper_changing_required: false,
              lifting_children_required: false,
            })
          } else {
            let reason = ''
            if (!isAvailable) {
              reason = 'Marked as unavailable'
            } else if (hasScheduleConflict) {
              reason = 'Scheduled to teach'
            } else if (hasTimeOffConflict) {
              reason = 'Has time off'
            } else {
              reason = 'Not available'
            }
            cannotCover.push({
              date: shift.date,
              day_name: dayName,
              time_slot_code: timeSlotCode,
              reason,
              classroom_name,
            })
          }
        })

        const coveragePercentage =
          shifts.length > 0 ? Math.round((availableShifts / shifts.length) * 100) : 0

        const name = sub.display_name || `${sub.first_name} ${sub.last_name}` || 'Unknown'

        const qualificationMatches = 0
        const qualificationTotal = 0

        return {
          id: sub.id,
          name,
          phone: sub.phone,
          email: sub.email,
          coverage_percent: coveragePercentage,
          shifts_covered: availableShifts,
          total_shifts: shifts.length,
          can_cover: canCover,
          cannot_cover: cannotCover,
          assigned_shifts: [],
          qualification_matches: qualificationMatches,
          qualification_total: qualificationTotal,
          can_change_diapers: subCapabilities.can_change_diapers,
          can_lift_children: subCapabilities.can_lift_children,
          response_status: null,
        }
      })
    )

    const filteredMatches = subMatches.sort((a, b) => {
      if (b.coverage_percent !== a.coverage_percent) {
        return b.coverage_percent - a.coverage_percent
      }
      return a.name.localeCompare(b.name)
    })

    const getCoverageShiftKey = (shift: {
      date: string
      time_slot_code: string
      classroom_id?: string | null
    }) =>
      shift.classroom_id
        ? `${shift.date}|${shift.time_slot_code}|${shift.classroom_id}`
        : `${shift.date}|${shift.time_slot_code}`

    const allShiftKeys = new Set<string>()
    const assignedShiftKeys = new Set<string>()
    filteredMatches.forEach(match => {
      match.can_cover?.forEach(
        (shift: { date: string; time_slot_code: string; classroom_id?: string | null }) => {
          allShiftKeys.add(getCoverageShiftKey(shift))
        }
      )
      match.cannot_cover?.forEach(
        (shift: { date: string; time_slot_code: string; classroom_id?: string | null }) => {
          allShiftKeys.add(getCoverageShiftKey(shift))
        }
      )
      match.assigned_shifts?.forEach(
        (shift: { date: string; time_slot_code: string; classroom_id?: string | null }) => {
          const key = getCoverageShiftKey(shift)
          allShiftKeys.add(key)
          assignedShiftKeys.add(key)
        }
      )
    })

    const remainingShiftKeys = Array.from(allShiftKeys).filter(key => !assignedShiftKeys.has(key))
    const totalShifts = filteredMatches[0]?.total_shifts || 0
    const remainingShiftCount = Math.max(0, totalShifts - assignedShiftKeys.size)
    const hasAssignedShifts = assignedShiftKeys.size > 0

    const enrichedMatches = filteredMatches.map(match => {
      const shiftChips = buildShiftChips({
        assigned: [],
        canCover: match.can_cover || [],
        cannotCover: match.cannot_cover || [],
        allowedShiftKeys: remainingShiftKeys,
      })

      return {
        ...match,
        remaining_shift_keys: remainingShiftKeys,
        remaining_shift_count: remainingShiftCount,
        has_assigned_shifts: hasAssignedShifts,
        shift_chips: shiftChips,
      }
    })

    const recommendedCombinations = findTopCombinations(enrichedMatches, 5)
    const recommendedCombination = recommendedCombinations[0] ?? null

    return NextResponse.json({
      subs: enrichedMatches,
      shift_details: sortedShiftDetails,
      totals: { total, uncovered, partially_covered, fully_covered },
      recommended_combination: recommendedCombination,
      recommended_combinations: recommendedCombinations,
    })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to find subs (manual)',
      500,
      'POST /api/sub-finder/find-subs-manual'
    )
  }
}
