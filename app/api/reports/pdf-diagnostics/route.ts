import { NextResponse } from 'next/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getPuppeteerLaunchDiagnostics } from '@/lib/reports/puppeteer-launch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    return NextResponse.json({
      checked_at: new Date().toISOString(),
      diagnostics: getPuppeteerLaunchDiagnostics(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to inspect PDF diagnostics.',
      },
      { status: 500 }
    )
  }
}
