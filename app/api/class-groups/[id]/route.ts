import { NextRequest, NextResponse } from 'next/server'
import { getClassGroupById, updateClassGroup, deleteClassGroup } from '@/lib/api/class-groups'
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const classGroup = await getClassGroupById(id)
    return NextResponse.json(classGroup)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to fetch class group',
      500,
      'GET /api/class-groups/[id]'
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const classGroup = await updateClassGroup(id, body)
    revalidateClassGroupDependentPaths()
    return NextResponse.json(classGroup)
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to update class group',
      500,
      'PUT /api/class-groups/[id]'
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteClassGroup(id)
    revalidateClassGroupDependentPaths()
    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(
      error,
      'Failed to delete class group',
      500,
      'DELETE /api/class-groups/[id]'
    )
  }
}
