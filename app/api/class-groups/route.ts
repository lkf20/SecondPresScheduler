import { NextRequest, NextResponse } from 'next/server'
import { getClassGroups, createClassGroup } from '@/lib/api/class-groups'
import { createErrorResponse } from '@/lib/utils/errors'

export async function GET() {
  try {
    const classGroups = await getClassGroups()
    return NextResponse.json(classGroups)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch class groups', 500, 'GET /api/class-groups')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const classGroupData = await createClassGroup(body)
    return NextResponse.json(classGroupData, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create class group', 500, 'POST /api/class-groups')
  }
}
