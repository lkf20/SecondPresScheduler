import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { getSubs } from '@/lib/api/subs'
import { getSubAvailability, getSubAvailabilityExceptions } from '@/lib/api/sub-availability'
import { getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { createErrorResponse } from '@/lib/utils/errors'
import { findTopCombinations } from '@/lib/utils/sub-combination'
import { buildShiftChips } from '@/lib/server/coverage/shift-chips'
import { getUserSchoolId } from '@/lib/utils/auth'

interface Shift {
  date: string
  day_of_week_id: string
  day_name: string
  time_slot_id: string
  time_slot_code: string
  class_group_id?: string | null
  classroom_id?: string | null
  classroom_name?: string | null
  classroom_color?: string | null
  diaper_changing_required?: boolean
  lifting_children_required?: boolean
  class_group_name?: string | null
}

interface SubMatch {
  id: string
  name: string
  phone: string | null
  email: string | null
  coverage_percent: number
  shifts_covered: number
  total_shifts: number
  can_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    class_name: string | null
    classroom_name?: string | null
    classroom_color?: string | null
    diaper_changing_required?: boolean
    lifting_children_required?: boolean
  }>
  cannot_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    reason: string
    classroom_name?: string | null
    coverage_request_shift_id?: string
  }>
  qualification_matches: number
  qualification_total: number
  can_change_diapers?: boolean
  can_lift_children?: boolean
  assigned_shifts?: Array<{
    date: string
    day_name: string
    time_slot_code: string
  }>
}

/**
 * Find available substitutes for a given absence/time off request
 *
 * Algorithm:
 * 1. Get the absence and all shifts that need coverage
 * 2. For each active sub:
 *    - Check availability (sub_availability + exceptions)
 *    - Check against their regular teaching schedule
 *    - Check against time off requests (calendar conflicts)
 *    - Check class qualifications (sub_class_preferences)
 * 3. Calculate coverage percentage
 * 4. Return sorted list of best matches
 */
const parseDateOnly = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export async function POST(request: NextRequest) {
  try {
    // Require schoolId from session
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'User profile not found or missing school_id. Please ensure your profile is set up.',
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { absence_id, include_flexible_staff = true, include_past_shifts = false } = body

    if (!absence_id) {
      return NextResponse.json({ error: 'absence_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Get the absence/time off request
    const timeOffRequest = await getTimeOffRequestById(absence_id)
    if (!timeOffRequest) {
      return NextResponse.json({ error: 'Time off request not found' }, { status: 404 })
    }

    // 2. Get all shifts that need coverage
    const shifts = await getTimeOffShifts(absence_id)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const shiftsToUse = include_past_shifts
      ? shifts
      : shifts.filter(shift => {
          if (!shift?.date) {
            return false
          }
          const shiftDate = parseDateOnly(shift.date)
          shiftDate.setHours(0, 0, 0, 0)
          return shiftDate >= today
        })

    if (shiftsToUse.length === 0) {
      return NextResponse.json([])
    }

    // Lookup classroom/class names from teacher schedule
    const scheduleLookup = new Map<string, { classrooms: Set<string>; classes: Set<string> }>()
    const classroomColorMap = new Map<string, string | null>() // classroom_name -> color
    const { data: teacherSchedules, error: scheduleError } = await supabase
      .from('teacher_schedules')
      .select('day_of_week_id, time_slot_id, classroom:classrooms(name, color)')
      .eq('teacher_id', timeOffRequest.teacher_id)

    if (scheduleError) {
      console.error('Error fetching teacher schedules:', scheduleError)
    } else {
      ;(teacherSchedules || []).forEach((schedule: any) => {
        const key = `${schedule.day_of_week_id}|${schedule.time_slot_id}`
        const entry = scheduleLookup.get(key) || {
          classrooms: new Set<string>(),
          classes: new Set<string>(),
        }
        if (schedule.classroom?.name) {
          entry.classrooms.add(schedule.classroom.name)
          // Store color mapping for this classroom name
          if (!classroomColorMap.has(schedule.classroom.name)) {
            classroomColorMap.set(schedule.classroom.name, schedule.classroom.color || null)
          }
        }
        // Note: class groups are no longer directly on teacher_schedules
        scheduleLookup.set(key, entry)
      })
    }

    // Get coverage_request_id to fetch class group info
    const coverageRequestId = (timeOffRequest as any).coverage_request_id

    // Get coverage_request_shifts with class group info and create shift ID map
    const classGroupInfoMap = new Map<
      string,
      {
        diaper_changing_required: boolean
        lifting_children_required: boolean
        class_group_name: string | null
        class_group_id: string | null
      }
    >()
    const shiftIdMap = new Map<string, string>() // key: date|time_slot_code|classroom_id, value: coverage_request_shift_id

    if (coverageRequestId) {
      const { data: coverageRequestShifts } = await supabase
        .from('coverage_request_shifts')
        .select(
          `
          id,
          date,
          time_slot_id,
          classroom_id,
          class_group_id,
          class_groups:class_group_id (
            name,
            diaper_changing_required,
            lifting_children_required
          ),
          time_slots:time_slot_id (code)
        `
        )
        .eq('coverage_request_id', coverageRequestId)

      if (coverageRequestShifts) {
        coverageRequestShifts.forEach((shift: any) => {
          const key = `${shift.date}|${shift.time_slots?.code || ''}`
          const classGroup = shift.class_groups
          classGroupInfoMap.set(key, {
            diaper_changing_required: classGroup?.diaper_changing_required ?? false,
            lifting_children_required: classGroup?.lifting_children_required ?? false,
            class_group_name: classGroup?.name || null,
            class_group_id: shift.class_group_id ?? null,
          })

          // Create shift ID map: date|time_slot_code|classroom_id -> coverage_request_shift_id
          const shiftIdKey = `${shift.date}|${shift.time_slots?.code || ''}|${shift.classroom_id || ''}`
          shiftIdMap.set(shiftIdKey, shift.id)
        })
      }
    }

    // Normalize shifts for easier processing
    const shiftsToCover: Shift[] = shiftsToUse.map((shift: any) => {
      const key = `${shift.date}|${shift.time_slot?.code || ''}`
      const classGroupInfo = classGroupInfoMap.get(key) || {
        diaper_changing_required: false,
        lifting_children_required: false,
        class_group_name: null,
        class_group_id: null,
      }
      const scheduleKey = `${shift.day_of_week_id}|${shift.time_slot_id}`
      const scheduleEntry = scheduleLookup.get(scheduleKey)
      const classroom_names = scheduleEntry?.classrooms?.size
        ? Array.from(scheduleEntry.classrooms)
        : []
      const classroom_name = classroom_names.length > 0 ? classroom_names.join(', ') : null
      // Get color from first classroom (or null if multiple)
      const classroom_color =
        classroom_names.length === 1 && classroom_names[0]
          ? classroomColorMap.get(classroom_names[0]) || null
          : null
      const class_name = scheduleEntry?.classes?.size
        ? Array.from(scheduleEntry.classes).join(', ')
        : classGroupInfo.class_group_name

      return {
        date: shift.date,
        day_of_week_id: shift.day_of_week_id,
        day_name: shift.day_of_week?.name || '',
        time_slot_id: shift.time_slot_id,
        time_slot_code: shift.time_slot?.code || '',
        class_group_id: classGroupInfo.class_group_id,
        classroom_id: null, // TODO: Get from schedule cells
        classroom_name,
        classroom_color,
        diaper_changing_required: classGroupInfo.diaper_changing_required,
        lifting_children_required: classGroupInfo.lifting_children_required,
        class_group_name: class_name,
      }
    })

    const { data: roleTypes, error: roleTypesError } = await supabase
      .from('staff_role_types')
      .select('id, code')
      .eq('school_id', schoolId)

    if (roleTypesError) {
      console.warn('Failed to load staff role types', roleTypesError)
    }
    const flexibleRoleTypeIds = new Set(
      (roleTypes || []).filter(rt => rt.code === 'FLEXIBLE').map(rt => rt.id)
    )
    let flexibleStaffIds = new Set<string>()
    if (flexibleRoleTypeIds.size > 0) {
      const { data: flexibleAssignments, error: flexibleAssignmentsError } = await supabase
        .from('staff_role_type_assignments')
        .select('staff_id')
        .eq('school_id', schoolId)
        .in('role_type_id', Array.from(flexibleRoleTypeIds))

      if (flexibleAssignmentsError) {
        console.warn('Failed to load flexible staff assignments', flexibleAssignmentsError)
      }

      flexibleStaffIds = new Set(
        (flexibleAssignments || []).map(assignment => assignment.staff_id).filter(Boolean)
      )
    }

    // 3. Get all active subs + flexible staff
    let staffQuery = supabase.from('staff').select('*').eq('school_id', schoolId)
    if (flexibleStaffIds.size > 0) {
      staffQuery = staffQuery.or(`is_sub.eq.true,id.in.(${Array.from(flexibleStaffIds).join(',')})`)
    } else {
      staffQuery = staffQuery.eq('is_sub', true)
    }

    const { data: staffRows, error: staffError } = await staffQuery
    if (staffError) {
      throw staffError
    }

    const activeSubs = (staffRows || []).filter(sub => sub.active !== false)
    const subIds = activeSubs.map(sub => sub.id).filter(Boolean)

    // 4. Get date range for checking conflicts
    const startDate = timeOffRequest.start_date
    const endDate = timeOffRequest.end_date || timeOffRequest.start_date

    // 5. Get all time off requests in the date range for conflict checking
    const conflictingTimeOffRequests = await getTimeOffRequests({
      start_date: startDate,
      end_date: endDate,
    })

    // Create a map of teacher_id -> time off requests for quick lookup
    const timeOffByTeacher = new Map<string, any[]>()
    conflictingTimeOffRequests.forEach((req: any) => {
      if (!timeOffByTeacher.has(req.teacher_id)) {
        timeOffByTeacher.set(req.teacher_id, [])
      }
      timeOffByTeacher.get(req.teacher_id)!.push(req)
    })

    // 6. For each sub, calculate match score
    const subMatches: SubMatch[] = await Promise.all(
      activeSubs.map(async sub => {
        // Get sub's availability
        const availability = await getSubAvailability(sub.id)
        const availabilityExceptions = await getSubAvailabilityExceptions(sub.id, {
          start_date: startDate,
          end_date: endDate,
        })

        // Create availability map: day_of_week_id + time_slot_id -> available
        const availabilityMap = new Map<string, boolean>()
        availability.forEach((avail: any) => {
          if (avail.available) {
            const key = `${avail.day_of_week_id}|${avail.time_slot_id}`
            availabilityMap.set(key, true)
          }
        })

        // Override with exceptions
        availabilityExceptions.forEach((exception: any) => {
          const key = `${exception.date}|${exception.time_slot_id}`
          availabilityMap.set(key, exception.available)
        })

        // Get sub's regular teaching schedule
        const subScheduledShifts = await getTeacherScheduledShifts(sub.id, startDate, endDate)

        // Create schedule conflict map: date + time_slot_id -> conflict
        const scheduleConflicts = new Set<string>()
        subScheduledShifts.forEach(scheduledShift => {
          const key = `${scheduledShift.date}|${scheduledShift.time_slot_id}`
          scheduleConflicts.add(key)
        })

        // Get sub's time off requests for conflict checking
        const subTimeOffRequests = timeOffByTeacher.get(sub.id) || []
        const timeOffConflicts = new Set<string>()

        // Fetch shifts for each time off request
        for (const req of subTimeOffRequests) {
          try {
            const reqShifts = await getTimeOffShifts(req.id)
            reqShifts.forEach((shift: any) => {
              const key = `${shift.date}|${shift.time_slot_id}`
              timeOffConflicts.add(key)
            })
          } catch (error) {
            console.error(`Error fetching shifts for time off request ${req.id}:`, error)
          }
        }

        // Get sub's class preferences/qualifications
        const { data: classPreferences } = await supabase
          .from('sub_class_preferences')
          .select('class_group_id, can_teach')
          .eq('sub_id', sub.id)
          .eq('can_teach', true)

        const qualifiedClassGroupIds = new Set(
          (classPreferences || []).map((pref: any) => pref.class_group_id)
        )

        // Get sub's capabilities
        const subCapabilities = {
          can_change_diapers: sub.can_change_diapers ?? false,
          can_lift_children: sub.can_lift_children ?? false,
        }

        // Calculate coverage
        let availableShifts = 0
        const canCover: Array<{
          date: string
          day_name: string
          time_slot_code: string
          class_name: string | null
          classroom_name?: string | null
          classroom_color?: string | null
          diaper_changing_required?: boolean
          lifting_children_required?: boolean
        }> = []
        const cannotCover: Array<{
          date: string
          day_name: string
          time_slot_code: string
          reason: string
          classroom_name?: string | null
          coverage_request_shift_id?: string
        }> = []
        let qualificationMatches = 0
        let qualificationTotal = 0

        shiftsToCover.forEach(shift => {
          const availabilityKey = `${shift.day_of_week_id}|${shift.time_slot_id}`
          const conflictKey = `${shift.date}|${shift.time_slot_id}`

          // Check if sub is available (base availability + exceptions)
          const isAvailable = availabilityMap.has(availabilityKey)
            ? availabilityMap.get(availabilityKey)!
            : false

          // Check for schedule conflicts
          const hasScheduleConflict = scheduleConflicts.has(conflictKey)

          // Check for time off conflicts
          const hasTimeOffConflict = timeOffConflicts.has(conflictKey)

          // Check qualifications (if class_group_id is known)
          let isQualified = true
          if (shift.class_group_id) {
            qualificationTotal++
            if (qualifiedClassGroupIds.has(shift.class_group_id)) {
              qualificationMatches++
            } else {
              isQualified = false
            }
          }

          if (isAvailable && !hasScheduleConflict && !hasTimeOffConflict && isQualified) {
            // Can cover this shift
            availableShifts++
            canCover.push({
              date: shift.date,
              day_name: shift.day_name,
              time_slot_code: shift.time_slot_code,
              class_name: shift.class_group_name || null,
              classroom_name: shift.classroom_name || null,
              classroom_color: shift.classroom_color || null,
              diaper_changing_required: shift.diaper_changing_required,
              lifting_children_required: shift.lifting_children_required,
            })
          } else {
            // Cannot cover - determine reason with better wording
            let reason = ''
            if (!isAvailable) {
              reason = 'Marked as unavailable'
            } else if (hasScheduleConflict) {
              reason = 'Scheduled to teach'
            } else if (hasTimeOffConflict) {
              reason = 'Has time off'
            } else if (!isQualified) {
              reason = 'Not qualified for this class'
            } else {
              reason = 'Not available'
            }

            // Get coverage_request_shift_id from map
            const shiftKey = `${shift.date}|${shift.time_slot_code}|${shift.classroom_id || ''}`
            const coverageRequestShiftId = shiftIdMap.get(shiftKey)

            cannotCover.push({
              date: shift.date,
              day_name: shift.day_name,
              time_slot_code: shift.time_slot_code,
              reason,
              classroom_name: shift.classroom_name || null,
              coverage_request_shift_id: coverageRequestShiftId,
            })
          }
        })

        // Check for existing assignments for this sub and coverage request
        const assignedShifts: Array<{
          date: string
          day_name: string
          time_slot_code: string
          classroom_name?: string | null
        }> = []

        if (coverageRequestId) {
          // Get teacher_id from coverage_request
          const { data: coverageRequest } = await supabase
            .from('coverage_requests')
            .select('teacher_id')
            .eq('id', coverageRequestId)
            .single()

          if (coverageRequest) {
            // Get existing sub_assignments for this sub, teacher, and date range
            const { data: existingAssignments } = await supabase
              .from('sub_assignments')
              .select(
                `
                date,
                time_slot_id,
                time_slots:time_slots(code),
                days_of_week:day_of_week_id(name)
              `
              )
              .eq('sub_id', sub.id)
              .eq('teacher_id', coverageRequest.teacher_id)
              .gte('date', startDate)
              .lte('date', endDate)
              .eq('assignment_type', 'Substitute Shift')

            if (existingAssignments) {
              existingAssignments.forEach((assignment: any) => {
                // Check if this assignment covers one of the shifts we're looking for
                const matchingShift = shiftsToCover.find(
                  s =>
                    s.date === assignment.date && s.time_slot_code === assignment.time_slots?.code
                )

                if (matchingShift) {
                  assignedShifts.push({
                    date: assignment.date,
                    day_name: assignment.days_of_week?.name || matchingShift.day_name,
                    time_slot_code: assignment.time_slots?.code || matchingShift.time_slot_code,
                    classroom_name: matchingShift.classroom_name || null,
                  })
                }
              })
            }
          }
        }

        const coveragePercentage =
          shiftsToCover.length > 0 ? Math.round((availableShifts / shiftsToCover.length) * 100) : 0

        const name = sub.display_name || `${sub.first_name} ${sub.last_name}` || 'Unknown'

        // Get response_status from substitute_contacts if coverage request exists
        let responseStatus: string | null = null
        if (coverageRequestId) {
          try {
            const { data: contact } = await supabase
              .from('substitute_contacts')
              .select('response_status')
              .eq('coverage_request_id', coverageRequestId)
              .eq('sub_id', sub.id)
              .single()

            if (contact) {
              responseStatus = contact.response_status
            }
          } catch {
            // Contact doesn't exist yet, which is fine
            console.debug(
              `No contact found for sub ${sub.id} and coverage request ${coverageRequestId}`
            )
          }
        }

        return {
          id: sub.id,
          name,
          phone: sub.phone,
          email: sub.email,
          coverage_percent: coveragePercentage,
          shifts_covered: availableShifts,
          total_shifts: shiftsToCover.length,
          can_cover: canCover,
          cannot_cover: cannotCover,
          assigned_shifts: assignedShifts, // Shifts already assigned to this sub
          qualification_matches: qualificationMatches,
          qualification_total: qualificationTotal,
          can_change_diapers: subCapabilities.can_change_diapers,
          can_lift_children: subCapabilities.can_lift_children,
          response_status: responseStatus,
        }
      })
    )

    // 7. Filter out subs with 0% coverage unless include_flexible_staff is true
    // (Flexible staff might be teachers who can sub when not teaching)
    let filteredMatches = subMatches
    if (!include_flexible_staff) {
      filteredMatches = subMatches.filter(match => match.coverage_percent > 0)
    }

    // 8. Sort by coverage percentage (descending), then by name
    filteredMatches.sort((a, b) => {
      if (b.coverage_percent !== a.coverage_percent) {
        return b.coverage_percent - a.coverage_percent
      }
      return a.name.localeCompare(b.name)
    })

    const allShiftKeys = new Set<string>()
    const assignedShiftKeys = new Set<string>()
    filteredMatches.forEach(match => {
      match.can_cover?.forEach((shift: { date: string; time_slot_code: string }) => {
        allShiftKeys.add(`${shift.date}|${shift.time_slot_code}`)
      })
      match.cannot_cover?.forEach((shift: { date: string; time_slot_code: string }) => {
        allShiftKeys.add(`${shift.date}|${shift.time_slot_code}`)
      })
      match.assigned_shifts?.forEach((shift: { date: string; time_slot_code: string }) => {
        const key = `${shift.date}|${shift.time_slot_code}`
        allShiftKeys.add(key)
        assignedShiftKeys.add(key)
      })
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
      recommended_combination: recommendedCombination,
      recommended_combinations: recommendedCombinations,
    })
  } catch (error) {
    return createErrorResponse(error, 'Failed to find subs', 500, 'POST /api/sub-finder/find-subs')
  }
}
