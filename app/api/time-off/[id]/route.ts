import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  getTimeOffRequestById,
  updateTimeOffRequest,
  getActiveSubAssignmentsForTimeOffRequest,
  cancelTimeOffRequest,
} from '@/lib/api/time-off'
import {
  getTimeOffShifts,
  createTimeOffShifts,
  getTeacherScheduledShifts,
  getTeacherTimeOffShifts,
  validateShiftsHaveClassroom,
} from '@/lib/api/time-off-shifts'
import { getUserSchoolId } from '@/lib/utils/auth'

const shouldDebugLog =
  process.env.NODE_ENV === 'development' || process.env.TIME_OFF_DEBUG === 'true'

const logTimeOffRouteError = (...args: unknown[]) => {
  if (shouldDebugLog) {
    console.error(...args)
  }
}
import { formatDateISOInTimeZone } from '@/lib/utils/date'
import { createClient } from '@/lib/supabase/server'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getSchoolClosuresForDateRange } from '@/lib/api/school-calendar'
import {
  canTransitionTimeOffStatus,
  formatTransitionError,
  type TimeOffStatus,
} from '@/lib/lifecycle/status-transitions'
import { isSlotClosedOnDate } from '@/lib/utils/school-closures'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { getStaffById } from '@/lib/api/staff'

// Helper function to format date as "Mon Jan 20"
function formatExcludedDate(dateStr: string, timeZone: string): string {
  if (!dateStr) return ''
  try {
    return formatDateISOInTimeZone(dateStr, timeZone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch (error) {
    console.error('Error formatting date:', dateStr, error)
    return dateStr // Return original if formatting fails
  }
}

/** Returns details for shifts that have at least one active sub_assignment (so they cannot be deleted). */
async function getShiftsWithActiveAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shiftIds: string[]
): Promise<Array<{ date: string; time_slot_id: string }>> {
  if (shiftIds.length === 0) return []
  const { data: assigned } = await supabase
    .from('sub_assignments')
    .select('coverage_request_shift_id')
    .in('coverage_request_shift_id', shiftIds)
    .eq('status', 'active')
  const assignedShiftIds = [
    ...new Set(
      (assigned || []).map(
        (r: { coverage_request_shift_id: string }) => r.coverage_request_shift_id
      )
    ),
  ]
  if (assignedShiftIds.length === 0) return []
  const { data: rows } = await supabase
    .from('time_off_shifts')
    .select('date, time_slot_id')
    .in('id', assignedShiftIds)
  return (rows || []).map((r: { date: string; time_slot_id: string }) => ({
    date: r.date,
    time_slot_id: r.time_slot_id,
  }))
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const requestData = await getTimeOffRequestById(id)
    const shifts = await getTimeOffShifts(id)
    return NextResponse.json({ ...requestData, shifts })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
}

// See docs/data-lifecycle.md: time_off_requests lifecycle
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { shifts, ...requestData } = body
    const existingRequest = await getTimeOffRequestById(id)
    const sessionSchoolId = await getUserSchoolId()
    const settingsSchoolId = existingRequest.school_id || sessionSchoolId
    const scheduleSettings = settingsSchoolId ? await getScheduleSettings(settingsSchoolId) : null
    const timeZone = scheduleSettings?.time_zone || 'UTC'
    const nextStatus = (requestData.status || existingRequest.status || 'active') as TimeOffStatus

    if (
      requestData.status &&
      existingRequest.status &&
      !canTransitionTimeOffStatus(existingRequest.status as TimeOffStatus, nextStatus)
    ) {
      return NextResponse.json(
        { error: formatTransitionError(existingRequest.status, nextStatus) },
        { status: 400 }
      )
    }

    const status = nextStatus
    const effectiveEndDate = requestData.end_date || requestData.start_date

    // Optimistic locking: if client sends updated_at, it must match the current row.
    if (
      requestData.updated_at != null &&
      existingRequest.updated_at != null &&
      String(requestData.updated_at) !== String(existingRequest.updated_at)
    ) {
      return NextResponse.json(
        {
          error:
            'This request was modified in another tab or window. Please refresh and try again.',
          code: 'REQUEST_MODIFIED',
        },
        { status: 409 }
      )
    }

    // When mode is select_shifts, require an explicit shifts array (can be empty) so we never
    // leave stale shifts when switching from all_scheduled to select_shifts with a malformed payload.
    if (requestData.shift_selection_mode === 'select_shifts' && !Array.isArray(shifts)) {
      return NextResponse.json(
        {
          error:
            'When using Select shifts, provide the shifts array in the request body (can be an empty array).',
          code: 'SELECT_SHIFTS_REQUIRES_SHIFTS_ARRAY',
        },
        { status: 400 }
      )
    }

    const normalizeDate = (dateStr: string) => {
      if (!dateStr) return ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
      const parsed = new Date(dateStr)
      return parsed.toISOString().split('T')[0]
    }

    // Overlap check only for new requests (POST). When editing (PUT), we allow the update
    // and the "filter out conflicting shifts" logic below will exclude shifts already on another
    // request, so the user does not get the overlapping-time-off alert when editing.
    // (The form already shows "This teacher already has time off recorded for N shifts...".)
    // Skip overlap 409 for PUT.

    let requestedShifts: Array<{ date: string; time_slot_id: string }> = []

    // Filter out conflicting shifts (but still allow the request to be updated)
    let shiftsToCreate: Array<{
      date: string
      day_of_week_id: string
      time_slot_id: string
      is_partial?: boolean
      start_time?: string | null
      end_time?: string | null
    }> = []
    let excludedShifts: Array<{ date: string }> = []
    let excludedShiftCount = 0
    let removedShiftCount = 0
    let shiftsCreatedCount = 0
    let warning: string | null = null

    // Update the time off request
    const updatedRequest = await updateTimeOffRequest(id, {
      ...requestData,
      status,
      school_id: existingRequest.school_id || sessionSchoolId || undefined,
    })

    const effectiveTeacherId = updatedRequest.teacher_id || existingRequest.teacher_id
    const teacherIdChanged =
      requestData.teacher_id !== undefined && requestData.teacher_id !== existingRequest.teacher_id
    const effectiveStartDate = updatedRequest.start_date || existingRequest.start_date
    const effectiveRequestEndDate =
      updatedRequest.end_date ||
      updatedRequest.start_date ||
      existingRequest.end_date ||
      existingRequest.start_date
    const effectiveShiftSelectionMode =
      requestData.shift_selection_mode ||
      updatedRequest.shift_selection_mode ||
      existingRequest.shift_selection_mode ||
      'all_scheduled'

    // Update the corresponding coverage_request's dates to match the time_off_request
    const supabase = await createClient()
    const { data: timeOffRequestWithCoverage } = await supabase
      .from('time_off_requests')
      .select('coverage_request_id, start_date, end_date')
      .eq('id', id)
      .single()

    if (timeOffRequestWithCoverage?.coverage_request_id) {
      const coverageRequestId = timeOffRequestWithCoverage.coverage_request_id
      // When teacher changes, validate that the new teacher exists and is active before
      // updating coverage_requests and sub_assignments (avoid stale/invalid teacher_id).
      if (teacherIdChanged && effectiveTeacherId) {
        try {
          const teacher = await getStaffById(effectiveTeacherId)
          if (!teacher) {
            return NextResponse.json(
              {
                error: 'Selected teacher not found.',
                code: 'TEACHER_NOT_FOUND',
              },
              { status: 400 }
            )
          }
          if ((teacher as { active?: boolean }).active === false) {
            return NextResponse.json(
              {
                error:
                  'Selected teacher is inactive. Activate the teacher first or choose another.',
                code: 'TEACHER_INACTIVE',
              },
              { status: 400 }
            )
          }
        } catch {
          return NextResponse.json(
            { error: 'Selected teacher not found.', code: 'TEACHER_NOT_FOUND' },
            { status: 400 }
          )
        }
      }
      // Always update dates to match the time_off_request
      const effectiveStartDate = timeOffRequestWithCoverage.start_date
      const effectiveEndDate =
        timeOffRequestWithCoverage.end_date || timeOffRequestWithCoverage.start_date

      const coverageUpdate: {
        start_date: string
        end_date: string
        updated_at: string
        teacher_id?: string
      } = {
        start_date: effectiveStartDate,
        end_date: effectiveEndDate,
        updated_at: new Date().toISOString(),
      }
      if (teacherIdChanged && effectiveTeacherId) {
        coverageUpdate.teacher_id = effectiveTeacherId
      }

      const { error: coverageUpdateError } = await supabase
        .from('coverage_requests')
        .update(coverageUpdate)
        .eq('id', coverageRequestId)

      if (coverageUpdateError) {
        console.error('[TimeOff Update] Error updating coverage_request:', coverageUpdateError)
        return NextResponse.json(
          {
            error:
              'Unable to update coverage record. Please try again or contact support if the problem persists.',
            code: 'COVERAGE_UPDATE_FAILED',
          },
          { status: 500 }
        )
      }

      // When teacher changes, update all sub_assignments for this coverage request so
      // teacher_id (absent teacher) stays in sync with the time off request.
      if (teacherIdChanged && effectiveTeacherId) {
        const { data: coverageShiftIds } = await supabase
          .from('coverage_request_shifts')
          .select('id')
          .eq('coverage_request_id', coverageRequestId)
        const shiftIds = (coverageShiftIds || []).map((row: { id: string }) => row.id)
        if (shiftIds.length > 0) {
          await supabase
            .from('sub_assignments')
            .update({ teacher_id: effectiveTeacherId })
            .in('coverage_request_shift_id', shiftIds)
        }
      }
    }

    // Handle shifts: full replace when client sends an explicit shifts array (select_shifts mode).
    // Use Array.isArray so we only replace when we have a real list; avoids leaving stale shifts
    // if the client ever sends shift_selection_mode 'select_shifts' but omits or malforms shifts.
    // Normalize explicit shifts to the request's date range so we never persist shifts outside it
    // (e.g. user changed end date to March 12 but form state still had March 13 selected).
    let effectiveShifts = shifts
    if (Array.isArray(shifts) && shifts.length > 0) {
      effectiveShifts = shifts.filter(
        (s: { date?: string }) =>
          normalizeDate(s.date || '') >= effectiveStartDate &&
          normalizeDate(s.date || '') <= effectiveRequestEndDate
      )
    }
    const shouldReplaceExplicitShifts = Array.isArray(shifts)
    const shouldSyncAllScheduled =
      !shouldReplaceExplicitShifts && effectiveShiftSelectionMode === 'all_scheduled'

    // Skip shift sync when only reason/notes/status changed (no date, teacher, mode, or explicit shifts).
    // Avoids unnecessary reads and trigger runs that can surface edge cases (e.g. counter constraints).
    const shiftAffectingChanged =
      shouldReplaceExplicitShifts ||
      (requestData.start_date !== undefined &&
        normalizeDate(requestData.start_date) !==
          normalizeDate(existingRequest.start_date || '')) ||
      (requestData.end_date !== undefined &&
        normalizeDate(requestData.end_date || requestData.start_date || '') !==
          normalizeDate(existingRequest.end_date || existingRequest.start_date || '')) ||
      (requestData.teacher_id !== undefined &&
        requestData.teacher_id !== existingRequest.teacher_id) ||
      (requestData.shift_selection_mode !== undefined &&
        requestData.shift_selection_mode !==
          (existingRequest.shift_selection_mode ?? 'all_scheduled'))

    if (shouldReplaceExplicitShifts || (shouldSyncAllScheduled && shiftAffectingChanged)) {
      // Exclude shifts on school closed days (no coverage needed)
      const requestSchoolId = existingRequest.school_id || sessionSchoolId
      const schoolClosures =
        requestSchoolId && effectiveStartDate && effectiveRequestEndDate
          ? await getSchoolClosuresForDateRange(
              requestSchoolId,
              effectiveStartDate,
              effectiveRequestEndDate
            )
          : []
      const closureList = schoolClosures.map(c => ({ date: c.date, time_slot_id: c.time_slot_id }))

      // select_shifts: diff-based update (add/remove only). Block removal of shifts that have
      // active sub assignments (409). all_scheduled: block removal when shift has assignment.
      // All_scheduled: only remove shifts beyond the new end date so we do NOT delete shifts
      // that still have sub_assignments (e.g. March 10–12 when user shortens to March 10–12;
      // March 13 is removed, March 10’s assignment stays).
      let currentRequestShifts: Awaited<ReturnType<typeof getTimeOffShifts>> = []
      let currentRequestShiftKeys = new Set<string>()
      if (shouldReplaceExplicitShifts) {
        currentRequestShifts = await getTimeOffShifts(id)
        currentRequestShiftKeys = new Set(
          currentRequestShifts.map(shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
        )
        const desiredKeys = new Set(
          (Array.isArray(effectiveShifts) ? effectiveShifts : []).map(
            (s: { date?: string; time_slot_id?: string }) =>
              `${normalizeDate(s.date || '')}::${s.time_slot_id || ''}`
          )
        )
        const toRemove = currentRequestShifts.filter(
          shift => !desiredKeys.has(`${normalizeDate(shift.date)}::${shift.time_slot_id}`)
        )
        const shiftsWithAssignments = await getShiftsWithActiveAssignments(
          supabase,
          toRemove.map(s => s.id)
        )
        if (shiftsWithAssignments.length > 0) {
          return NextResponse.json(
            {
              code: 'SHIFTS_HAVE_ASSIGNMENTS',
              error:
                'One or more shifts you are removing have a sub assigned. Remove the sub assignment for each shift first, then try again.',
              shifts: shiftsWithAssignments,
            },
            { status: 409 }
          )
        }
        if (toRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from('time_off_shifts')
            .delete()
            .eq('time_off_request_id', id)
            .in(
              'id',
              toRemove.map(s => s.id)
            )
          if (deleteError) throw deleteError
          removedShiftCount = toRemove.length
        }
        let toAddRaw = (Array.isArray(effectiveShifts) ? effectiveShifts : []).filter(
          (s: { date?: string; time_slot_id?: string }) =>
            !currentRequestShiftKeys.has(
              `${normalizeDate(s.date || '')}::${s.time_slot_id || ''}`
            ) && !isSlotClosedOnDate(normalizeDate(s.date || ''), s.time_slot_id || '', closureList)
        )
        if (toAddRaw.length > 0 && status !== 'draft') {
          const existingShiftsOther = await getTeacherTimeOffShifts(
            effectiveTeacherId,
            effectiveStartDate,
            effectiveRequestEndDate,
            id
          )
          const existingShiftKeysOther = new Set(
            existingShiftsOther.map(s => `${normalizeDate(s.date)}::${s.time_slot_id}`)
          )
          toAddRaw = toAddRaw.filter(
            (s: { date?: string; time_slot_id?: string }) =>
              !existingShiftKeysOther.has(`${normalizeDate(s.date || '')}::${s.time_slot_id || ''}`)
          )
        }
        const toAdd = toAddRaw.map(
          (s: { date?: string; day_of_week_id?: string; time_slot_id?: string }) => ({
            date: normalizeDate(s.date || ''),
            day_of_week_id: s.day_of_week_id || '',
            time_slot_id: s.time_slot_id || '',
            is_partial: false,
            start_time: null,
            end_time: null,
          })
        )
        if (toAdd.length > 0 && effectiveTeacherId && settingsSchoolId) {
          const validation = await validateShiftsHaveClassroom(
            effectiveTeacherId,
            settingsSchoolId,
            toAdd.map(s => ({ day_of_week_id: s.day_of_week_id, time_slot_id: s.time_slot_id }))
          )
          if (!validation.valid) {
            return NextResponse.json(
              {
                error:
                  'This teacher has no scheduled classroom for one or more of the selected shifts. Add them to the baseline schedule (Settings → Baseline Schedule) for those days and time slots, or remove those shifts.',
                code: 'SHIFTS_MISSING_CLASSROOM',
                missingShifts: validation.missingShifts,
              },
              { status: 400 }
            )
          }
        }
        if (toAdd.length > 0) {
          await createTimeOffShifts(id, toAdd)
          shiftsCreatedCount = toAdd.length
        }
      }
      if (shouldSyncAllScheduled) {
        currentRequestShifts = await getTimeOffShifts(id)
        currentRequestShiftKeys = new Set(
          currentRequestShifts.map(shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
        )
      }

      type SyncRemovedResult =
        | { removedCount: number }
        | { blocked: Array<{ date: string; time_slot_id: string }> }
      const syncRemovedShifts = async (
        desiredShiftKeys: Set<string>
      ): Promise<SyncRemovedResult | void> => {
        if (!shouldSyncAllScheduled || currentRequestShifts.length === 0) {
          return
        }

        const shiftsToRemove = currentRequestShifts.filter(
          shift => !desiredShiftKeys.has(`${normalizeDate(shift.date)}::${shift.time_slot_id}`)
        )

        if (shiftsToRemove.length === 0) {
          return
        }

        const shiftIdsToRemove = shiftsToRemove.map(shift => shift.id)
        const withAssignments = await getShiftsWithActiveAssignments(supabase, shiftIdsToRemove)
        if (withAssignments.length > 0) {
          return { blocked: withAssignments }
        }

        const { error: removeShiftsError } = await supabase
          .from('time_off_shifts')
          .delete()
          .eq('time_off_request_id', id)
          .in('id', shiftIdsToRemove)

        if (removeShiftsError) {
          throw removeShiftsError
        }

        removedShiftCount = shiftsToRemove.length
        return { removedCount: shiftsToRemove.length }
      }

      if (Array.isArray(effectiveShifts) && effectiveShifts.length > 0) {
        requestedShifts = effectiveShifts.map((shift: any) => ({
          date: shift.date,
          time_slot_id: shift.time_slot_id,
        }))
      } else if (effectiveShiftSelectionMode === 'all_scheduled') {
        const scheduledShifts = await getTeacherScheduledShifts(
          effectiveTeacherId,
          effectiveStartDate,
          effectiveRequestEndDate,
          timeZone
        )
        requestedShifts = scheduledShifts.map(shift => ({
          date: shift.date,
          time_slot_id: shift.time_slot_id,
        }))
      }
      requestedShifts = requestedShifts.filter(
        s => !isSlotClosedOnDate(normalizeDate(s.date), s.time_slot_id, closureList)
      )

      if (requestedShifts.length > 0 && status !== 'draft') {
        const existingShifts = await getTeacherTimeOffShifts(
          effectiveTeacherId,
          effectiveStartDate,
          effectiveRequestEndDate,
          id // Exclude current request
        )
        const existingShiftKeys = new Set(
          existingShifts.map(shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
        )

        // Filter out conflicting shifts (use effectiveShifts = in-range only)
        if (Array.isArray(effectiveShifts) && effectiveShifts.length > 0) {
          const excluded = effectiveShifts.filter(
            (shift: { date?: string; time_slot_id?: string }) => {
              const shiftKey = `${normalizeDate(shift.date || '')}::${shift.time_slot_id || ''}`
              return existingShiftKeys.has(shiftKey)
            }
          )

          excludedShifts = excluded.map((shift: { date?: string }) => ({
            date: normalizeDate(shift.date || ''),
          }))

          shiftsToCreate = effectiveShifts
            .filter((shift: { date?: string; time_slot_id?: string }) => {
              const shiftKey = `${normalizeDate(shift.date || '')}::${shift.time_slot_id || ''}`
              return !existingShiftKeys.has(shiftKey)
            })
            .filter(
              (shift: { date?: string; time_slot_id?: string }) =>
                !isSlotClosedOnDate(
                  normalizeDate(shift.date || ''),
                  shift.time_slot_id || '',
                  closureList
                )
            )
          excludedShiftCount = excludedShifts.length
        } else if (effectiveShiftSelectionMode === 'all_scheduled') {
          // If "all_scheduled" mode, fetch all scheduled shifts and filter out conflicts
          const scheduledShifts = await getTeacherScheduledShifts(
            effectiveTeacherId,
            effectiveStartDate,
            effectiveRequestEndDate,
            timeZone
          )

          const excluded = scheduledShifts.filter(shift => {
            const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
            return existingShiftKeys.has(shiftKey)
          })

          excludedShifts = excluded.map(shift => ({
            date: shift.date,
          }))

          const desiredShiftKeys = new Set(
            scheduledShifts
              .filter(shift => {
                const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
                return !existingShiftKeys.has(shiftKey)
              })
              .map(shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
          )

          const syncResult = await syncRemovedShifts(desiredShiftKeys)
          if (
            syncResult &&
            'blocked' in syncResult &&
            syncResult.blocked &&
            syncResult.blocked.length > 0
          ) {
            return NextResponse.json(
              {
                code: 'SHIFTS_HAVE_ASSIGNMENTS',
                error:
                  'One or more shifts you are removing have a sub assigned. Remove the sub assignment for each shift first, then try again.',
                shifts: syncResult.blocked,
              },
              { status: 409 }
            )
          }

          shiftsToCreate = scheduledShifts
            .map(shift => ({
              date: shift.date,
              day_of_week_id: shift.day_of_week_id,
              time_slot_id: shift.time_slot_id,
              is_partial: false,
              start_time: null,
              end_time: null,
            }))
            .filter(shift => {
              const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
              return !existingShiftKeys.has(shiftKey) && !currentRequestShiftKeys.has(shiftKey)
            })
            .filter(
              shift =>
                !isSlotClosedOnDate(normalizeDate(shift.date), shift.time_slot_id, closureList)
            )
          excludedShiftCount = excludedShifts.length
        }

        if (excludedShiftCount > 0 && excludedShifts.length > 0) {
          try {
            // Remove duplicates by date (same date can appear multiple times with different time slots)
            const uniqueExcludedDates = Array.from(
              new Set(excludedShifts.map(s => s.date).filter(Boolean))
            )
              .map(date => {
                try {
                  return formatExcludedDate(date, timeZone)
                } catch (err) {
                  console.error('Error formatting excluded date:', date, err)
                  return null
                }
              })
              .filter((date): date is string => Boolean(date)) // Remove any null/empty values

            if (uniqueExcludedDates.length > 0) {
              const formattedDates = uniqueExcludedDates.join(', ')
              warning = `This teacher already has time off recorded for ${excludedShiftCount} of these shifts.<br>${excludedShiftCount} shift${excludedShiftCount !== 1 ? 's' : ''} will not be recorded: ${formattedDates}`
            } else {
              // Fallback if date formatting fails
              warning = `This teacher already has time off recorded for ${excludedShiftCount} of these shifts.<br>${excludedShiftCount} shift${excludedShiftCount !== 1 ? 's' : ''} will not be recorded.`
            }
          } catch (error) {
            console.error('Error processing excluded shifts:', error)
            // Fallback warning if processing fails
            warning = `This teacher already has time off recorded for ${excludedShiftCount} of these shifts.<br>${excludedShiftCount} shift${excludedShiftCount !== 1 ? 's' : ''} will not be recorded.`
          }
        }
      } else {
        // No conflicts to check, use all requested shifts (effectiveShifts = in-range only)
        if (Array.isArray(effectiveShifts) && effectiveShifts.length > 0) {
          shiftsToCreate = effectiveShifts.filter(
            (shift: { date?: string; time_slot_id?: string }) =>
              !isSlotClosedOnDate(
                normalizeDate(shift.date || ''),
                shift.time_slot_id || '',
                closureList
              )
          )
        } else if (effectiveShiftSelectionMode === 'all_scheduled') {
          const scheduledShifts = await getTeacherScheduledShifts(
            effectiveTeacherId,
            effectiveStartDate,
            effectiveRequestEndDate,
            timeZone
          )

          const desiredShiftKeys = new Set(
            scheduledShifts.map(shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
          )
          const syncResult2 = await syncRemovedShifts(desiredShiftKeys)
          if (
            syncResult2 &&
            'blocked' in syncResult2 &&
            syncResult2.blocked &&
            syncResult2.blocked.length > 0
          ) {
            return NextResponse.json(
              {
                code: 'SHIFTS_HAVE_ASSIGNMENTS',
                error:
                  'One or more shifts you are removing have a sub assigned. Remove the sub assignment for each shift first, then try again.',
                shifts: syncResult2.blocked,
              },
              { status: 409 }
            )
          }

          shiftsToCreate = scheduledShifts
            .map(shift => ({
              date: shift.date,
              day_of_week_id: shift.day_of_week_id,
              time_slot_id: shift.time_slot_id,
              is_partial: false,
              start_time: null,
              end_time: null,
            }))
            .filter(shift => {
              const shiftKey = `${normalizeDate(shift.date)}::${shift.time_slot_id}`
              return !currentRequestShiftKeys.has(shiftKey)
            })
            .filter(
              shift =>
                !isSlotClosedOnDate(normalizeDate(shift.date), shift.time_slot_id, closureList)
            )
        }
      }

      // Defensive: never create shifts outside the request date range (guards against
      // timezone/parse edge cases or bugs in upstream shift building).
      if (effectiveStartDate && effectiveRequestEndDate) {
        shiftsToCreate = shiftsToCreate.filter(s => {
          const d = normalizeDate(s.date)
          return d >= effectiveStartDate && d <= effectiveRequestEndDate
        })
      }

      // Require every new shift to have a teacher_schedule row with classroom (same school).
      if (shiftsToCreate.length > 0 && effectiveTeacherId && settingsSchoolId) {
        const validation = await validateShiftsHaveClassroom(
          effectiveTeacherId,
          settingsSchoolId,
          shiftsToCreate.map(s => ({
            day_of_week_id: s.day_of_week_id,
            time_slot_id: s.time_slot_id,
          }))
        )
        if (!validation.valid) {
          return NextResponse.json(
            {
              error:
                'This teacher has no scheduled classroom for one or more of the selected shifts. Add them to the baseline schedule (Settings → Baseline Schedule) for those days and time slots, or remove those shifts.',
              code: 'SHIFTS_MISSING_CLASSROOM',
              missingShifts: validation.missingShifts,
            },
            { status: 400 }
          )
        }
      }

      // All_scheduled: defensive cleanup — remove any shift with date > new end (e.g. format edge cases).
      // Do not delete shifts that have active sub assignments; return 409.
      if (shouldSyncAllScheduled) {
        const { data: beyondEndShifts } = await supabase
          .from('time_off_shifts')
          .select('id')
          .eq('time_off_request_id', id)
          .gt('date', effectiveRequestEndDate)
        if (beyondEndShifts?.length) {
          const beyondIds = beyondEndShifts.map((s: { id: string }) => s.id)
          const beyondWithAssignments = await getShiftsWithActiveAssignments(supabase, beyondIds)
          if (beyondWithAssignments.length > 0) {
            return NextResponse.json(
              {
                code: 'SHIFTS_HAVE_ASSIGNMENTS',
                error:
                  'One or more shifts you are removing have a sub assigned. Remove the sub assignment for each shift first, then try again.',
                shifts: beyondWithAssignments,
              },
              { status: 409 }
            )
          }
          const { error: beyondDeleteError } = await supabase
            .from('time_off_shifts')
            .delete()
            .eq('time_off_request_id', id)
            .in('id', beyondIds)
          if (!beyondDeleteError) removedShiftCount += beyondIds.length
        }
      }

      // Create shifts (only non-conflicting ones). Skip when select_shifts: we already applied diff-based add/remove above.
      if (shiftsToCreate.length > 0 && !shouldReplaceExplicitShifts) {
        await createTimeOffShifts(id, shiftsToCreate)
        shiftsCreatedCount = shiftsToCreate.length
      }

      if (process.env.NODE_ENV !== 'production') {
        const { count: persistedShiftCount, error: shiftCountError } = await supabase
          .from('time_off_shifts')
          .select('id', { count: 'exact', head: true })
          .eq('time_off_request_id', id)

        if (shiftCountError) {
          console.error('[TimeOff Update] Failed to count persisted shifts:', shiftCountError)
        }
      }

      // After shifts are created/updated, set request and coverage dates from actual shifts
      // so the displayed range (e.g. Mar 10–12) matches the shifts and is consistent everywhere.
      const persistedShiftsForRange = await getTimeOffShifts(id)
      if (persistedShiftsForRange.length > 0) {
        const dates = persistedShiftsForRange
          .map(s => normalizeDate(s.date))
          .filter(Boolean)
          .sort()
        if (dates.length > 0) {
          const minDate = dates[0]
          const maxDate = dates[dates.length - 1]

          await updateTimeOffRequest(id, { start_date: minDate, end_date: maxDate })

          if (timeOffRequestWithCoverage?.coverage_request_id) {
            await supabase
              .from('coverage_requests')
              .update({
                start_date: minDate,
                end_date: maxDate,
                updated_at: new Date().toISOString(),
              })
              .eq('id', timeOffRequestWithCoverage.coverage_request_id)
          }
        }
      }
      // If there are no shifts, leave time_off_requests dates as updated from requestData
      // (coverage_requests already updated above from time_off_requests when we had coverage_request_id).
    }

    // Draft may have no shifts; non-draft (active) time off must have at least one shift.
    if (status !== 'draft') {
      const finalShiftCount = (await getTimeOffShifts(id)).length
      if (finalShiftCount === 0) {
        try {
          await updateTimeOffRequest(id, { status: existingRequest.status })
        } catch (e) {
          console.error('[TimeOff Update] Failed to revert status after zero-shifts check:', e)
          return NextResponse.json(
            {
              error:
                'We could not save your changes. The request may be in an inconsistent state. Please refresh and try again, or save as draft.',
              code: 'REVERT_FAILED',
            },
            { status: 500 }
          )
        }
        return NextResponse.json(
          {
            error:
              'Select at least one shift to save this time off request. Save as draft if you want to add shifts later.',
            code: 'TIME_OFF_REQUIRES_SHIFTS',
          },
          { status: 400 }
        )
      }
    }

    // Revalidate all pages that might show this data
    revalidatePath('/dashboard')
    revalidatePath('/time-off')
    revalidatePath('/schedules/weekly')
    revalidatePath('/sub-finder')
    revalidatePath('/reports')

    const normalizeText = (value: unknown) => {
      if (value === null || value === undefined) return null
      const text = String(value).trim()
      return text.length > 0 ? text : null
    }

    const changedFields: string[] = []
    if (existingRequest.status !== status) changedFields.push('status')
    if (existingRequest.teacher_id !== updatedRequest.teacher_id) changedFields.push('teacher_id')
    if (existingRequest.start_date !== updatedRequest.start_date) changedFields.push('start_date')
    if ((existingRequest.end_date || null) !== (updatedRequest.end_date || null)) {
      changedFields.push('end_date')
    }
    if (normalizeText(existingRequest.reason) !== normalizeText(updatedRequest.reason)) {
      changedFields.push('reason')
    }
    if (normalizeText(existingRequest.notes) !== normalizeText(updatedRequest.notes)) {
      changedFields.push('notes')
    }
    if ((existingRequest.shift_selection_mode || null) !== (effectiveShiftSelectionMode || null)) {
      changedFields.push('shift_selection_mode')
    }

    const beforeShiftKeys = new Set(
      (existingRequest.shifts || []).map(
        shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`
      )
    )
    const persistedShifts = await getTimeOffShifts(id)
    const afterShiftKeys = new Set(
      persistedShifts.map(shift => `${normalizeDate(shift.date)}::${shift.time_slot_id}`)
    )
    const shiftsChanged =
      beforeShiftKeys.size !== afterShiftKeys.size ||
      Array.from(beforeShiftKeys).some(key => !afterShiftKeys.has(key)) ||
      Array.from(afterShiftKeys).some(key => !beforeShiftKeys.has(key))

    if (shiftsChanged) {
      changedFields.push('shifts')
    }

    const finalRequest = await getTimeOffRequestById(id)
    const { actorUserId, actorDisplayName } = await getAuditActorContext()
    const teacherName = existingRequest.teacher
      ? getStaffDisplayName(existingRequest.teacher)
      : null

    if (finalRequest?.school_id && changedFields.length > 0) {
      await logAuditEvent({
        schoolId: finalRequest.school_id,
        actorUserId,
        actorDisplayName,
        action: existingRequest.status === status ? 'update' : 'status_change',
        category: 'time_off',
        entityType: 'time_off_request',
        entityId: id,
        details: {
          changed_fields: changedFields,
          before: {
            status: existingRequest.status,
            teacher_id: existingRequest.teacher_id,
            start_date: existingRequest.start_date,
            end_date: existingRequest.end_date,
            reason: existingRequest.reason,
            notes: existingRequest.notes,
            shift_selection_mode: existingRequest.shift_selection_mode,
            shift_count: existingRequest.shifts?.length || 0,
          },
          after: {
            status: finalRequest.status,
            teacher_id: finalRequest.teacher_id,
            start_date: finalRequest.start_date,
            end_date: finalRequest.end_date,
            reason: finalRequest.reason,
            notes: finalRequest.notes,
            shift_selection_mode: finalRequest.shift_selection_mode,
            shift_count: persistedShifts.length,
          },
          shifts_created: shiftsCreatedCount,
          shifts_removed: removedShiftCount,
          shifts_excluded: excludedShiftCount,
          teacher_name: teacherName,
        },
      })
    }

    return NextResponse.json({
      ...finalRequest,
      warning,
      excludedShiftCount,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { keepAssignmentsAsExtraCoverage = false, assignmentIdsToKeep = undefined } = body

    // First, get active sub assignments to return summary
    const activeAssignments = await getActiveSubAssignmentsForTimeOffRequest(id)

    // If there are assignments, we need the director's choice
    if (activeAssignments.length > 0 && body.action === undefined) {
      // Return summary for the UI dialog
      const timeOffRequest = await getTimeOffRequestById(id)
      const teacher = timeOffRequest?.teacher

      // Format assignments for display
      const formattedAssignments = activeAssignments.map((assignment: any) => {
        const shift = assignment.coverage_request_shift
        const sub = assignment.sub
        const dayName = shift?.days_of_week?.name || ''
        const timeSlot = shift?.time_slots?.code || ''
        const classroom = shift?.classrooms?.name || ''
        const subName =
          sub?.display_name ||
          `${sub?.first_name || ''} ${sub?.last_name || ''}`.trim() ||
          'Unknown'

        // Format date: "Mon Feb 10" format
        const date = new Date(shift?.date || '')
        const dayNameShort = dayName.substring(0, 3) // "Mon" from "Monday"
        const monthShort = date.toLocaleDateString('en-US', { month: 'short' })
        const day = date.getDate()
        const dateStr = `${dayNameShort} ${monthShort} ${day}`

        return {
          id: assignment.id,
          display: `${dateStr} • ${timeSlot} • ${subName} • ${classroom}`,
          date: shift?.date,
          dayName,
          timeSlot,
          subName,
          classroom,
        }
      })

      return NextResponse.json({
        hasAssignments: true,
        assignmentCount: activeAssignments.length,
        assignments: formattedAssignments,
        teacherName:
          teacher?.display_name ||
          `${teacher?.first_name || ''} ${teacher?.last_name || ''}`.trim(),
      })
    }

    const timeOffRequestBeforeCancel = await getTimeOffRequestById(id)

    // Perform cancellation
    const result = await cancelTimeOffRequest(id, {
      keepAssignmentsAsExtraCoverage,
      assignmentIdsToKeep,
    })

    revalidatePath('/dashboard')
    revalidatePath('/time-off')
    revalidatePath('/schedules/weekly')
    revalidatePath('/sub-finder')
    revalidatePath('/reports')

    const schoolId = await getUserSchoolId()
    const { actorUserId, actorDisplayName } = await getAuditActorContext()
    const teacherName = timeOffRequestBeforeCancel.teacher
      ? getStaffDisplayName(timeOffRequestBeforeCancel.teacher)
      : null
    if (schoolId) {
      await logAuditEvent({
        schoolId,
        actorUserId,
        actorDisplayName,
        action: 'cancel',
        category: 'time_off',
        entityType: 'time_off_request',
        entityId: id,
        details: {
          changed_fields: ['status', 'sub_assignments'],
          keepAssignmentsAsExtraCoverage,
          assignmentIdsToKeep: assignmentIdsToKeep || null,
          cancellation_result: result,
          teacher_name: teacherName,
        },
      })
    }

    // Return the cancellation result
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    logTimeOffRouteError('Error cancelling time off request:', error)
    if (error?.message === 'Time off request is already cancelled') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
