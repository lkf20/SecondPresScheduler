import { NextResponse } from 'next/server'
import { getWeeklyScheduleData } from '@/lib/api/weekly-schedule'
import { getScheduleSettings } from '@/lib/api/schedule-settings'

export async function GET() {
  try {
    // Get selected days from schedule settings (gracefully handle if table doesn't exist)
    let selectedDayIds: string[] = []
    try {
      const settings = await getScheduleSettings()
      selectedDayIds = settings?.selected_day_ids || []
    } catch (settingsError: any) {
      // If schedule_settings table doesn't exist, continue without filtering
      console.warn('Could not load schedule settings, using all days:', settingsError.message)
    }
    
    // If no days selected, use all days (fallback)
    const data = await getWeeklyScheduleData(
      selectedDayIds.length > 0 ? selectedDayIds : undefined
    )
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching weekly schedule:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

