import { NextRequest, NextResponse } from 'next/server'
import { getAllTeacherSchedules, createTeacherSchedule } from '@/lib/api/schedules'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filters: any = {}
    if (searchParams.get('teacher_id')) {
      filters.teacher_id = searchParams.get('teacher_id')
    }
    
    const schedules = await getAllTeacherSchedules(filters)
    return NextResponse.json(schedules)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schedule = await createTeacherSchedule(body)
    return NextResponse.json(schedule, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

