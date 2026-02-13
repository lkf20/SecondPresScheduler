import { NextRequest, NextResponse } from 'next/server'
import { getScheduleSettings, updateScheduleSettings } from '@/lib/api/schedule-settings'
import { getUserSchoolId } from '@/lib/utils/auth'

export async function GET() {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }
    const settings = await getScheduleSettings(schoolId)
    return NextResponse.json(
      settings || { selected_day_ids: [], default_display_name_format: 'first_last_initial' }
    )
  } catch (error: any) {
    console.error('Error fetching schedule settings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id.' },
        { status: 403 }
      )
    }
    const body = await request.json()
    const { selected_day_ids, default_display_name_format } = body

    if (!Array.isArray(selected_day_ids)) {
      return NextResponse.json({ error: 'selected_day_ids must be an array' }, { status: 400 })
    }

    if (
      default_display_name_format &&
      !['first_last_initial', 'first_initial_last', 'first_last', 'first_name'].includes(
        default_display_name_format
      )
    ) {
      return NextResponse.json({ error: 'Invalid display name format' }, { status: 400 })
    }

    const settings = await updateScheduleSettings(
      schoolId,
      selected_day_ids,
      default_display_name_format
    )
    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
