import { NextRequest, NextResponse } from 'next/server'
import { getClassrooms, createClassroom, setClassroomAllowedClasses } from '@/lib/api/classrooms'
import { createErrorResponse } from '@/lib/utils/errors'

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    const classrooms = await getClassrooms(includeInactive)
    return NextResponse.json(classrooms)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch classrooms', 500, 'GET /api/classrooms')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { allowed_class_group_ids, allowed_classes, ...classroomData } = body

    // Create the classroom
    const classroom = await createClassroom(classroomData)

    // Set allowed classes if provided
    const allowedClassGroupIds = Array.isArray(allowed_class_group_ids)
      ? allowed_class_group_ids
      : Array.isArray(allowed_classes)
        ? allowed_classes
        : null
    if (allowedClassGroupIds) {
      await setClassroomAllowedClasses(classroom.id, allowedClassGroupIds)
    }

    return NextResponse.json(classroom, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create classroom', 500, 'POST /api/classrooms')
  }
}
