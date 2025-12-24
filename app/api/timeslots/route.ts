import { NextRequest, NextResponse } from 'next/server'
import { getTimeSlots, createTimeSlot } from '@/lib/api/timeslots'

export async function GET() {
  try {
    const timeslots = await getTimeSlots()
    return NextResponse.json(timeslots)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const timeslot = await createTimeSlot(body)
    return NextResponse.json(timeslot, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

