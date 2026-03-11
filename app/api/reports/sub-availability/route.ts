import { NextResponse } from 'next/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getSubAvailabilityReportData } from '@/lib/api/sub-availability'
import { buildSubAvailabilityReportModel } from '@/lib/reports/sub-availability-pdf'
import { formatGeneratedAt } from '@/lib/reports/rich-text'

const parseNameFormat = (value: string | null): 'display' | 'full' =>
  value === 'full' ? 'full' : 'display'

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const nameFormat = parseNameFormat(searchParams.get('nameFormat'))
    const { timeZone, days, timeSlots, classGroups, subs, availabilityRows, preferences } =
      await getSubAvailabilityReportData(schoolId)

    const reportContext = buildSubAvailabilityReportModel(
      {
        subs: subs || [],
        days,
        timeSlots: timeSlots || [],
        availabilityRows,
        classGroups,
        preferences,
      },
      { nameFormat }
    )

    const now = new Date()
    return NextResponse.json({
      generated_at: formatGeneratedAt(now, timeZone),
      sub_count: reportContext.rows.length,
      report_context: reportContext,
    })
  } catch (error: any) {
    console.error('Error generating sub availability report data:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch sub availability report data.' },
      { status: 500 }
    )
  }
}
