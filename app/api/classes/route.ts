import { NextRequest, NextResponse } from 'next/server'
import { getClasses, createClass } from '@/lib/api/classes'
import { createErrorResponse } from '@/lib/utils/errors'

export async function GET() {
  try {
    const classes = await getClasses()
    return NextResponse.json(classes)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch classes', 500, 'GET /api/classes')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const classData = await createClass(body)
    return NextResponse.json(classData, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create class', 500, 'POST /api/classes')
  }
}



