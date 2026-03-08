import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import {
  buildSubAvailabilityReportModel,
  formatGeneratedAt,
} from '@/lib/reports/sub-availability-pdf'

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

    const supabase = await createClient()
    const scheduleSettings = await getScheduleSettings(schoolId)
    const selectedDayIds = scheduleSettings?.selected_day_ids ?? []
    const timeZone = scheduleSettings?.time_zone || 'UTC'

    let days: Array<{ id: string; name: string; display_order: number | null }> = []
    if (selectedDayIds.length > 0) {
      const { data: daysData, error: daysError } = await supabase
        .from('days_of_week')
        .select('id, name, display_order')
        .in('id', selectedDayIds)
        .order('display_order', { ascending: true })

      if (daysError) throw daysError
      days = daysData || []
    }

    const { data: timeSlots, error: timeSlotsError } = await supabase
      .from('time_slots')
      .select('id, code, name, display_order')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (timeSlotsError) throw timeSlotsError

    const { data: classGroups, error: classGroupsError } = await supabase
      .from('class_groups')
      .select('id, name, "order", min_age')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('min_age', { ascending: true })

    if (classGroupsError) throw classGroupsError

    const { data: subs, error: subsError } = await supabase
      .from('staff')
      .select('id, first_name, last_name, display_name, phone')
      .eq('school_id', schoolId)
      .eq('is_sub', true)
      .eq('active', true)
      .order('last_name', { ascending: true })

    if (subsError) throw subsError

    const subIds = (subs || []).map(sub => sub.id)

    let availabilityRows: Array<{
      sub_id: string
      day_of_week_id: string
      time_slot_id: string
      available: boolean | null
    }> = []

    let preferences: Array<{
      sub_id: string
      class_group_id: string | null
      can_teach: boolean | null
    }> = []

    if (subIds.length > 0) {
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('sub_availability')
        .select('sub_id, day_of_week_id, time_slot_id, available')
        .eq('school_id', schoolId)
        .in('sub_id', subIds)
        .order('sub_id', { ascending: true })

      if (availabilityError) throw availabilityError
      availabilityRows = availabilityData || []

      const { data: preferenceData, error: preferencesError } = await supabase
        .from('sub_class_preferences')
        .select('sub_id, class_group_id, can_teach')
        .eq('school_id', schoolId)
        .eq('can_teach', true)
        .in('sub_id', subIds)
        .order('sub_id', { ascending: true })

      if (preferencesError) throw preferencesError
      preferences = preferenceData || []
    }

    const reportContext = buildSubAvailabilityReportModel(
      {
        subs: subs || [],
        days,
        timeSlots: timeSlots || [],
        availabilityRows,
        classGroups: (classGroups || []).map(group => ({
          ...group,
          order: group.order,
          min_age: group.min_age,
        })),
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
