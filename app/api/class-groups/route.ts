import { NextRequest, NextResponse } from 'next/server'
import { getClassGroups, createClassGroup } from '@/lib/api/class-groups'
import { createErrorResponse } from '@/lib/utils/errors'
import { revalidatePath } from 'next/cache'
import {
  RatioValidationError,
  validateOptionalRatio,
  validateRequiredRatio,
} from '@/lib/validations/class-group-ratios'

function revalidateClassGroupDependentPaths() {
  revalidatePath('/settings/classes')
  revalidatePath('/settings/classrooms')
  revalidatePath('/schedules/weekly')
  revalidatePath('/settings/baseline-schedule')
  revalidatePath('/reports/daily-schedule')
  revalidatePath('/sub-finder')
}

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    const classGroups = await getClassGroups(includeInactive)
    return NextResponse.json(classGroups)
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch class groups', 500, 'GET /api/class-groups')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if ('required_ratio' in body) {
      body.required_ratio = validateRequiredRatio(body.required_ratio)
    }
    if ('preferred_ratio' in body) {
      body.preferred_ratio = validateOptionalRatio(body.preferred_ratio, { allowNull: true })
    }
    const classGroupData = await createClassGroup(body)
    revalidateClassGroupDependentPaths()
    return NextResponse.json(classGroupData, { status: 201 })
  } catch (error) {
    if (error instanceof RatioValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return createErrorResponse(error, 'Failed to create class group', 500, 'POST /api/class-groups')
  }
}
