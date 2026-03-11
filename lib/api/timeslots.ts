import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getUserSchoolId } from '@/lib/utils/auth'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

function validateTimeRange(values: {
  default_start_time?: string | null
  default_end_time?: string | null
}) {
  const start =
    typeof values.default_start_time === 'string' ? values.default_start_time.trim() : ''
  const end = typeof values.default_end_time === 'string' ? values.default_end_time.trim() : ''

  if (!start || !end) {
    throw new Error('Start time and end time are required')
  }

  if (end <= start) {
    throw new Error('End time must be after start time')
  }
}

function timeToMinutes(time24: string | null | undefined): number {
  if (!time24) return Number.MAX_SAFE_INTEGER
  const [hours, minutes] = time24.split(':')
  const hour24 = Number.parseInt(hours, 10)
  const mins = Number.parseInt(minutes || '0', 10)
  if (Number.isNaN(hour24) || Number.isNaN(mins)) return Number.MAX_SAFE_INTEGER
  return hour24 * 60 + mins
}

export function sortTimeSlotsForDisplayOrder(a: TimeSlot, b: TimeSlot): number {
  const aStart = timeToMinutes(a.default_start_time)
  const bStart = timeToMinutes(b.default_start_time)
  if (aStart !== bStart) return aStart - bStart

  const aExistingOrder = a.display_order ?? Number.MAX_SAFE_INTEGER
  const bExistingOrder = b.display_order ?? Number.MAX_SAFE_INTEGER
  if (aExistingOrder !== bExistingOrder) return aExistingOrder - bExistingOrder

  return (a.code || '').localeCompare(b.code || '')
}

async function resequenceTimeSlotsByStartTime(schoolId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.from('time_slots').select('*').eq('school_id', schoolId)

  if (error) throw error

  const sorted = [...((data as TimeSlot[]) || [])].sort(sortTimeSlotsForDisplayOrder)
  const updates = sorted.map((slot, index) => ({
    id: slot.id,
    display_order: index + 1,
  }))

  const changed = updates.filter(
    (next, index) => (sorted[index]?.display_order ?? null) !== next.display_order
  )
  if (changed.length === 0) return

  await Promise.all(
    changed.map(async change => {
      const { error: updateError } = await supabase
        .from('time_slots')
        .update({ display_order: change.display_order })
        .eq('id', change.id)
      if (updateError) throw updateError
    })
  )
}

export async function getTimeSlots(schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('time_slots').select('*').order('display_order', { ascending: true })

  // If schoolId is provided, filter by it. Otherwise, get from session.
  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return data as TimeSlot[]
}

export async function getTimeSlotsWithInactive(schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('time_slots').select('*').order('display_order', { ascending: true })

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as TimeSlot[]
}

export async function getTimeSlotById(id: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('time_slots').select('*').eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.single()

  if (error) throw error
  return data as TimeSlot
}

export async function createTimeSlot(timeslot: {
  code: string
  name?: string
  default_start_time?: string
  default_end_time?: string
  display_order?: number
  is_active?: boolean
  school_id?: string
}) {
  const supabase = await createClient()
  validateTimeRange(timeslot)

  // Get school_id if not provided
  const schoolId = timeslot.school_id || (await getUserSchoolId())
  if (!schoolId) {
    throw new Error('school_id is required to create a time slot')
  }

  const { data, error } = await supabase
    .from('time_slots')
    .insert({ ...timeslot, school_id: schoolId, is_active: timeslot.is_active ?? true })
    .select()
    .single()

  if (error) throw error
  await resequenceTimeSlotsByStartTime(schoolId)
  return data as TimeSlot
}

export async function updateTimeSlot(id: string, updates: Partial<TimeSlot>, schoolId?: string) {
  const supabase = await createClient()
  if ('default_start_time' in updates || 'default_end_time' in updates) {
    validateTimeRange({
      default_start_time: (updates.default_start_time as string | null | undefined) ?? '',
      default_end_time: (updates.default_end_time as string | null | undefined) ?? '',
    })
  }
  let query = supabase.from('time_slots').update(updates).eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { data, error } = await query.select().single()

  if (error) throw error
  if ((data as TimeSlot)?.school_id) {
    await resequenceTimeSlotsByStartTime((data as TimeSlot).school_id as string)
  }
  return data as TimeSlot
}

export async function deleteTimeSlot(id: string, schoolId?: string) {
  const supabase = await createClient()
  let query = supabase.from('time_slots').update({ is_active: false }).eq('id', id)

  const effectiveSchoolId = schoolId || (await getUserSchoolId())
  if (effectiveSchoolId) {
    query = query.eq('school_id', effectiveSchoolId)
  }

  const { error } = await query.select().single()

  if (error) throw error
}
