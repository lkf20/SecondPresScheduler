import { NextRequest, NextResponse } from 'next/server'
import { getAllTeacherSchedules, createTeacherSchedule } from '@/lib/api/schedules'
import { createErrorResponse } from '@/lib/utils/errors'
import {
  teacherScheduleFiltersSchema,
  createTeacherScheduleSchema,
} from '@/lib/validations/teacher-schedules'
import { validateQueryParams, validateRequest } from '@/lib/utils/validation'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Validate query parameters
    const validation = validateQueryParams(teacherScheduleFiltersSchema, searchParams)
    if (!validation.success) {
      return validation.error
    }

    const schedules = await getAllTeacherSchedules(validation.data)
    return NextResponse.json(schedules)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to fetch teacher schedules',
      500,
      'GET /api/teacher-schedules'
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Normalize legacy class_id into class_group_id to avoid schema cache errors
    if (body?.class_id !== undefined && body?.class_group_id === undefined) {
      body.class_group_id = body.class_id
    }
    if (body?.class_id !== undefined) {
      delete body.class_id
    }

    // Validate request body
    const validation = validateRequest(createTeacherScheduleSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const schedule = await createTeacherSchedule(validation.data)
    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to create teacher schedule',
      500,
      'POST /api/teacher-schedules'
    )
  }
}
