import { NextRequest, NextResponse } from 'next/server'
import { getSubs, createSub } from '@/lib/api/subs'
import { getUserSchoolId } from '@/lib/utils/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const includeNonSub = request.nextUrl.searchParams.get('include_non_sub') === 'true'
    const onlyActive = request.nextUrl.searchParams.get('active_only') === 'true'
    const subs = await getSubs({ includeNonSub, onlyActive })
    return NextResponse.json(subs)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
    const sub = await createSub({ ...body, school_id: schoolId })
    return NextResponse.json(sub, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
