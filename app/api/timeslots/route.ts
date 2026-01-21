import { NextRequest, NextResponse } from 'next/server'
import { getTimeSlots, createTimeSlot } from '@/lib/api/timeslots'
import { createErrorResponse } from '@/lib/utils/errors'

export async function GET() {
  try {
    const timeslots = await getTimeSlots()
    return NextResponse.json(timeslots)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch time slots', 500, 'GET /api/timeslots')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const timeslot = await createTimeSlot(body)
    return NextResponse.json(timeslot, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create time slot', 500, 'POST /api/timeslots')
  }
}



