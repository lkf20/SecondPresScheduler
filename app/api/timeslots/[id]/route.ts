import { NextRequest, NextResponse } from 'next/server'
import { getTimeSlotById, updateTimeSlot, deleteTimeSlot } from '@/lib/api/timeslots'
import { createErrorResponse } from '@/lib/utils/errors'
import { revalidatePath } from 'next/cache'

function revalidateTimeSlotDependentPaths() {
  revalidatePath('/settings/timeslots')
  revalidatePath('/schedules/weekly')
  revalidatePath('/settings/baseline-schedule')
  revalidatePath('/reports/daily-schedule')
  revalidatePath('/sub-finder')
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const timeslot = await getTimeSlotById(id)
    return NextResponse.json(timeslot)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch time slot', 500, 'GET /api/timeslots/[id]')
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const timeslot = await updateTimeSlot(id, body)
    revalidateTimeSlotDependentPaths()
    return NextResponse.json(timeslot)
  } catch (error) {
    return createErrorResponse(error, 'Failed to update time slot', 500, 'PUT /api/timeslots/[id]')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteTimeSlot(id)
    revalidateTimeSlotDependentPaths()
    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to delete time slot',
      500,
      'DELETE /api/timeslots/[id]'
    )
  }
}
