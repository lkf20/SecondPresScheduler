import { NextRequest, NextResponse } from 'next/server'
import { createStaff, getStaff } from '@/lib/api/staff'
import { getUserSchoolId } from '@/lib/utils/auth'

function getErrorStatus(error: unknown): number {
  const maybeError = error as { code?: string; message?: string } | undefined
  const code = maybeError?.code
  const message = maybeError?.message?.toLowerCase() || ''

  if (code === 'P0002') return 404
  if (code === '23505' || code === '23514') return 409
  if (code === '22P02' || code === '23502' || code === '23503') return 400
  if (message.includes('not found')) return 404

  return 500
}

export async function GET() {
  try {
    const staff = await getStaff()
    return NextResponse.json(staff)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error) })
  }
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const staff = await createStaff({ ...body, school_id: schoolId })
    return NextResponse.json(staff)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error) })
  }
}
