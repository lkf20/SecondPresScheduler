import { NextRequest, NextResponse } from 'next/server'
import { getTeachers, createTeacher } from '@/lib/api/teachers'
import { createErrorResponse } from '@/lib/utils/errors'

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
    const body = await request.json()
    const teacher = await createTeacher(body)
    return NextResponse.json(teacher, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create teacher', 500, 'POST /api/teachers')
  }
}



