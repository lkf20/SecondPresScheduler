import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffRequestById } from '@/lib/api/time-off'
import { getTimeOffShifts } from '@/lib/api/time-off-shifts'
import { getSubs } from '@/lib/api/subs'
import { getSubAvailability, getSubAvailabilityExceptions } from '@/lib/api/sub-availability'
import { getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'
import { getTimeOffRequests } from '@/lib/api/time-off'
import { createErrorResponse } from '@/lib/utils/errors'

interface Shift {
  date: string
  day_of_week_id: string
  day_name: string
  time_slot_id: string
  time_slot_code: string
  class_id?: string | null
  classroom_id?: string | null
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
  }>
  cannot_cover: Array<{
    date: string
    day_name: string
    time_slot_code: string
    reason: string
  }>
  qualification_matches: number
  qualification_total: number
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { absence_id, include_flexible_staff = true } = body

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
    if (shifts.length === 0) {
      return NextResponse.json([])
    }

    // Normalize shifts for easier processing
    const shiftsToCover: Shift[] = shifts.map((shift: any) => ({
      date: shift.date,
      day_of_week_id: shift.day_of_week_id,
      day_name: shift.day_of_week?.name || '',
      time_slot_id: shift.time_slot_id,
      time_slot_code: shift.time_slot?.code || '',
      class_id: null, // TODO: Get from schedule cells
      classroom_id: null, // TODO: Get from schedule cells
    }))

    // 3. Get all active subs
    const allSubs = await getSubs()
    const activeSubs = allSubs.filter((sub) => sub.active !== false)

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
      activeSubs.map(async (sub) => {
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
        const subScheduledShifts = await getTeacherScheduledShifts(
          sub.id,
          startDate,
          endDate
        )

        // Create schedule conflict map: date + time_slot_id -> conflict
        const scheduleConflicts = new Set<string>()
        subScheduledShifts.forEach((scheduledShift) => {
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
          .select('class_id, can_teach')
          .eq('sub_id', sub.id)
          .eq('can_teach', true)

        const qualifiedClassIds = new Set(
          (classPreferences || []).map((pref: any) => pref.class_id)
        )

        // Calculate coverage
        let availableShifts = 0
        const canCover: Array<{
          date: string
          day_name: string
          time_slot_code: string
          class_name: string | null
        }> = []
        const cannotCover: Array<{
          date: string
          day_name: string
          time_slot_code: string
          reason: string
        }> = []
        let qualificationMatches = 0
        let qualificationTotal = 0

        shiftsToCover.forEach((shift) => {
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

          // Check qualifications (if class_id is known)
          let isQualified = true
          let qualificationReason = ''
          if (shift.class_id) {
            qualificationTotal++
            if (qualifiedClassIds.has(shift.class_id)) {
              qualificationMatches++
            } else {
              isQualified = false
              qualificationReason = 'Not qualified for class'
            }
          }

          if (isAvailable && !hasScheduleConflict && !hasTimeOffConflict && isQualified) {
            // Can cover this shift
            availableShifts++
            canCover.push({
              date: shift.date,
              day_name: shift.day_name,
              time_slot_code: shift.time_slot_code,
              class_name: shift.class_id ? null : null, // TODO: Get class name from class_id
            })
          } else {
            // Cannot cover - determine reason
            let reason = ''
            if (!isAvailable) {
              reason = 'Not available'
            } else if (hasScheduleConflict) {
              reason = 'Has scheduled shift'
            } else if (hasTimeOffConflict) {
              reason = 'Has time off'
            } else if (!isQualified) {
              reason = qualificationReason || 'Not qualified for class'
            }
            
            cannotCover.push({
              date: shift.date,
              day_name: shift.day_name,
              time_slot_code: shift.time_slot_code,
              reason,
            })
          }
        })

        const coveragePercentage =
          shiftsToCover.length > 0
            ? Math.round((availableShifts / shiftsToCover.length) * 100)
            : 0

        const name =
          sub.display_name || `${sub.first_name} ${sub.last_name}` || 'Unknown'

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
          qualification_matches: qualificationMatches,
          qualification_total: qualificationTotal,
        }
      })
    )

    // 7. Filter out subs with 0% coverage unless include_flexible_staff is true
    // (Flexible staff might be teachers who can sub when not teaching)
    let filteredMatches = subMatches
    if (!include_flexible_staff) {
      filteredMatches = subMatches.filter((match) => match.coverage_percent > 0)
    }

    // 8. Sort by coverage percentage (descending), then by name
    filteredMatches.sort((a, b) => {
      if (b.coverage_percent !== a.coverage_percent) {
        return b.coverage_percent - a.coverage_percent
      }
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json(filteredMatches)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to find subs',
      500,
      'POST /api/sub-finder/find-subs'
    )
  }
}

