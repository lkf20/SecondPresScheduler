import { NextResponse } from 'next/server'
import { getWeeklyScheduleData } from '@/lib/api/weekly-schedule'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { getUserSchoolId } from '@/lib/utils/auth'

export async function GET(request: Request) {
  try {
    // Require schoolId from session
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json(
        { error: 'User profile not found or missing school_id. Please ensure your profile is set up.' },
        { status: 403 }
      )
    }
    
    // Get weekStartISO from query params
    const { searchParams } = new URL(request.url)
    const weekStartISO = searchParams.get('weekStartISO')
    
    // Get selected days from schedule settings (gracefully handle if table doesn't exist)
    let selectedDayIds: string[] = []
    try {
      const settings = await getScheduleSettings(schoolId)
      selectedDayIds = settings?.selected_day_ids || []
    } catch (settingsError: any) {
      // If schedule_settings table doesn't exist, continue without filtering
      console.warn('Could not load schedule settings, using all days:', settingsError.message)
    }
    
    // If no days selected, use all days (fallback)
    const data = await getWeeklyScheduleData(
      schoolId,
      selectedDayIds.length > 0 ? selectedDayIds : undefined,
      weekStartISO || undefined
    )
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching weekly schedule:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        code: error.code,
        details: error.details,
        hint: error.hint
      } : undefined
    }, { status: 500 })
  }
}

