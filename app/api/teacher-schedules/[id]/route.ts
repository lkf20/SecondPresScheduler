import { NextRequest, NextResponse } from 'next/server'
import {
  getTeacherScheduleById,
  updateTeacherSchedule,
  deleteTeacherSchedule,
} from '@/lib/api/schedules'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const schedule = await getTeacherScheduleById(id)
    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    // Normalize legacy class_id into class_group_id to avoid schema cache errors
    if (body?.class_id !== undefined && body?.class_group_id === undefined) {
      body.class_group_id = body.class_id
    }
    if (body?.class_id !== undefined) {
      delete body.class_id
    }
    const schedule = await updateTeacherSchedule(id, body)
    if (!schedule) {
      return NextResponse.json({ updated: false }, { status: 200 })
    }
    return NextResponse.json(schedule)
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
    await deleteTeacherSchedule(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
