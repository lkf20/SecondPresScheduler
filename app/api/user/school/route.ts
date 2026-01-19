import { NextResponse } from 'next/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { createErrorResponse } from '@/lib/utils/errors'

/**
 * GET /api/user/school
 * Get the current user's school_id from their profile
 */
export async function GET() {
  try {
    const schoolId = await getUserSchoolId()
    
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id. Please ensure your profile is set up.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ schoolId })
  } catch (error) {
    console.error('Error getting school ID:', error)
    return createErrorResponse(error, 'Failed to get school ID', 500)
  }
}
