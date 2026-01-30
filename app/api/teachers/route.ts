import { NextRequest, NextResponse } from 'next/server'
import { getTeachers, createTeacher } from '@/lib/api/teachers'
import { createErrorResponse } from '@/lib/utils/errors'
import { getUserSchoolId } from '@/lib/utils/auth'

export async function GET() {
  try {
    const teachers = await getTeachers()
    return NextResponse.json(teachers)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch teachers', 500, 'GET /api/teachers')
  }
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return createErrorResponse('User profile not found or missing school_id.', 403)
    }
    const body = await request.json()
    const teacher = await createTeacher({ ...body, school_id: schoolId })
    return NextResponse.json(teacher, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create teacher', 500, 'POST /api/teachers')
  }
}
