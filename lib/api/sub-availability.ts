import { createClient } from '@/lib/supabase/server'
import { getScheduleSettings } from '@/lib/api/schedule-settings'
import { Database } from '@/types/database'

type SubAvailability = Database['public']['Tables']['sub_availability']['Row']
type SubAvailabilityException = Database['public']['Tables']['sub_availability_exceptions']['Row']
type DayOfWeek = Database['public']['Tables']['days_of_week']['Row']
type TimeSlot = Database['public']['Tables']['time_slots']['Row']
type SubAvailabilityWithDetails = SubAvailability & { day_of_week: DayOfWeek; time_slot: TimeSlot }
type SubAvailabilityExceptionWithDetails = SubAvailabilityException & { time_slot: TimeSlot }

type ReportDayRow = Pick<Database['public']['Tables']['days_of_week']['Row'], 'id' | 'name'> & {
  display_order: number | null
}
type ReportTimeSlotRow = Pick<
  Database['public']['Tables']['time_slots']['Row'],
  'id' | 'code' | 'name'
> & {
  display_order: number | null
}
type ReportClassGroupRow = Pick<
  Database['public']['Tables']['class_groups']['Row'],
  'id' | 'name'
> & {
  order: number | null
  min_age: number | null
}
type ReportSubRow = Pick<
  Database['public']['Tables']['staff']['Row'],
  'id' | 'first_name' | 'last_name' | 'display_name' | 'phone'
>
type ReportAvailabilityRow = Pick<
  Database['public']['Tables']['sub_availability']['Row'],
  'sub_id' | 'day_of_week_id' | 'time_slot_id' | 'available'
>
type ReportPreferenceRow = Pick<
  Database['public']['Tables']['sub_class_preferences']['Row'],
  'sub_id' | 'class_group_id' | 'can_teach'
>

export type SubAvailabilityReportData = {
  timeZone: string
  days: ReportDayRow[]
  timeSlots: ReportTimeSlotRow[]
  classGroups: ReportClassGroupRow[]
  subs: ReportSubRow[]
  availabilityRows: ReportAvailabilityRow[]
  preferences: ReportPreferenceRow[]
}

export async function getSubAvailabilityReportData(
  schoolId: string
): Promise<SubAvailabilityReportData> {
  const supabase = await createClient()
  const scheduleSettings = await getScheduleSettings(schoolId)
  const selectedDayIds = scheduleSettings?.selected_day_ids ?? []
  const timeZone = scheduleSettings?.time_zone || 'UTC'

  let days: ReportDayRow[] = []
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

  let availabilityRows: ReportAvailabilityRow[] = []
  let preferences: ReportPreferenceRow[] = []

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

  return {
    timeZone,
    days,
    timeSlots: timeSlots || [],
    classGroups: (classGroups || []).map(group => ({
      ...group,
      order: group.order,
      min_age: group.min_age,
    })),
    subs: subs || [],
    availabilityRows,
    preferences,
  }
}

export async function getSubAvailability(subId: string): Promise<SubAvailabilityWithDetails[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sub_availability')
    .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*)')
    .eq('sub_id', subId)

  if (error) throw error
  return (data || []) as SubAvailabilityWithDetails[]
}

export async function upsertSubAvailability(
  subId: string,
  availability: {
    day_of_week_id: string
    time_slot_id: string
    available: boolean
  }
) {
  const supabase = await createClient()
  const { data: subRow, error: subError } = await supabase
    .from('staff')
    .select('school_id')
    .eq('id', subId)
    .single()

  if (subError) throw subError
  const schoolId = subRow?.school_id
  if (!schoolId) throw new Error('school_id is required for sub availability')
  const { data, error } = await supabase
    .from('sub_availability')
    .upsert(
      {
        sub_id: subId,
        ...availability,
        school_id: schoolId,
      },
      {
        onConflict: 'sub_id,day_of_week_id,time_slot_id',
      }
    )
    .select()
    .single()

  if (error) throw error
  return data as SubAvailability
}

export async function getSubAvailabilityExceptions(
  subId: string,
  filters?: { start_date?: string; end_date?: string }
): Promise<SubAvailabilityExceptionWithDetails[]> {
  const supabase = await createClient()
  let query = supabase
    .from('sub_availability_exceptions')
    .select('*, time_slot:time_slots(*)')
    .eq('sub_id', subId)
    .order('date', { ascending: false })

  if (filters?.start_date) {
    query = query.gte('date', filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte('date', filters.end_date)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []) as SubAvailabilityExceptionWithDetails[]
}

export async function createSubAvailabilityException(exception: {
  sub_id: string
  date: string
  time_slot_id: string
  available: boolean
}) {
  const supabase = await createClient()
  const { data: subRow, error: subError } = await supabase
    .from('staff')
    .select('school_id')
    .eq('id', exception.sub_id)
    .single()

  if (subError) throw subError
  const schoolId = subRow?.school_id
  if (!schoolId) throw new Error('school_id is required for sub availability exceptions')
  const { data, error } = await supabase
    .from('sub_availability_exceptions')
    .insert({ ...exception, school_id: schoolId })
    .select()
    .single()

  if (error) throw error
  return data as SubAvailabilityException
}

export async function deleteSubAvailabilityException(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('sub_availability_exceptions').delete().eq('id', id)

  if (error) throw error
}
