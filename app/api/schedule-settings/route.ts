import { NextRequest, NextResponse } from 'next/server'
import { getScheduleSettings, updateScheduleSettings } from '@/lib/api/schedule-settings'

export async function GET() {
  try {
    const settings = await getScheduleSettings()
    return NextResponse.json(settings || { selected_day_ids: [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { selected_day_ids } = body

    if (!Array.isArray(selected_day_ids)) {
      return NextResponse.json(
        { error: 'selected_day_ids must be an array' },
        { status: 400 }
      )
    }

    const settings = await updateScheduleSettings(selected_day_ids)
    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

