import { NextRequest, NextResponse } from 'next/server'
import { getClassGroups, createClassGroup } from '@/lib/api/class-groups'
import { createErrorResponse } from '@/lib/utils/errors'
import { revalidatePath } from 'next/cache'

function revalidateClassGroupDependentPaths() {
  revalidatePath('/settings/classes')
  revalidatePath('/settings/classrooms')
  revalidatePath('/schedules/weekly')
  revalidatePath('/settings/baseline-schedule')
  revalidatePath('/reports/daily-schedule')
  revalidatePath('/sub-finder')
}

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
    revalidateClassGroupDependentPaths()
    return NextResponse.json(classGroupData, { status: 201 })
  } catch (error) {
    return createErrorResponse(error, 'Failed to create class group', 500, 'POST /api/class-groups')
  }
}
