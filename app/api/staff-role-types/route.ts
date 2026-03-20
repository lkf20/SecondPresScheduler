import { NextResponse } from 'next/server'
import { getStaffRoleTypes } from '@/lib/api/staff-role-types'
import { getUserSchoolId } from '@/lib/utils/auth'

export async function GET() {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'User profile not found or missing school_id. Please ensure your profile is set up.',
        },
        { status: 403 }
      )
    }

    const roleTypes = await getStaffRoleTypes(schoolId)
    return NextResponse.json(roleTypes)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
