import { NextRequest, NextResponse } from 'next/server'
import {
  getTeacherSchedules,
  bulkCreateTeacherSchedules,
  deleteTeacherSchedulesByTeacher,
} from '@/lib/api/schedules'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const schedules = await getTeacherSchedules(id)
    return NextResponse.json(schedules)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { schedules } = body

    if (!Array.isArray(schedules)) {
      return NextResponse.json({ error: 'schedules must be an array' }, { status: 400 })
    }

    const createdSchedules = await bulkCreateTeacherSchedules(id, schedules)
    return NextResponse.json(createdSchedules, { status: 201 })
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
    await deleteTeacherSchedulesByTeacher(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
