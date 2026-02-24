import { NextRequest, NextResponse } from 'next/server'
import { getTimeSlots, getTimeSlotsWithInactive, createTimeSlot } from '@/lib/api/timeslots'
import { createErrorResponse } from '@/lib/utils/errors'
import { revalidatePath } from 'next/cache'

function revalidateTimeSlotDependentPaths() {
  revalidatePath('/settings/timeslots')
  revalidatePath('/schedules/weekly')
  revalidatePath('/settings/baseline-schedule')
  revalidatePath('/reports/daily-schedule')
  revalidatePath('/sub-finder')
}

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    const timeslots = includeInactive ? await getTimeSlotsWithInactive() : await getTimeSlots()
    return NextResponse.json(timeslots)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch time slots', 500, 'GET /api/timeslots')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const timeslot = await createTimeSlot(body)
    revalidateTimeSlotDependentPaths()
    return NextResponse.json(timeslot, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create time slot', 500, 'POST /api/timeslots')
  }
}
