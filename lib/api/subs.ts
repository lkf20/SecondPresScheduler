import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { getStaffDisplayName } from '@/lib/utils/staff-display-name'
import { normalizeEmailForStorage } from '@/lib/utils/email'
import { normalizeUSPhoneForStorage } from '@/lib/utils/phone'

type Staff = Database['public']['Tables']['staff']['Row']

export async function getSubs() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('staff').select('*').eq('is_sub', true)

  if (error) throw error

  // Sort by display_name, falling back to first_name + last_name if display_name is null
  const sorted = (data as Staff[]).sort((a, b) => {
    const nameA = getStaffDisplayName({
      first_name: a.first_name ?? '',
      last_name: a.last_name ?? '',
      display_name: a.display_name ?? null,
    })
    const nameB = getStaffDisplayName({
      first_name: b.first_name ?? '',
      last_name: b.last_name ?? '',
      display_name: b.display_name ?? null,
    })
    return nameA.localeCompare(nameB)
  })

  return sorted
}

export async function getSubById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .eq('is_sub', true)
    .single()

  if (error) throw error
  return data as Staff
}

export async function createSub(sub: {
  id?: string
  first_name: string
  last_name: string
  display_name?: string
  phone?: string
  email?: string
  is_teacher?: boolean
  is_sub: boolean
  active?: boolean
  school_id?: string
}) {
  const supabase = await createClient()
  if (!sub.school_id) {
    throw new Error('school_id is required to create sub')
  }
  const normalizedEmail = normalizeEmailForStorage(sub.email)
  if (sub.email && sub.email.trim() !== '' && !normalizedEmail) {
    throw new Error('Invalid email address')
  }

  // Exclude id from the insert if it's undefined or empty
  const { id, ...subData } = sub
  const insertData: Partial<Staff> & { id: string } = {
    first_name: subData.first_name,
    last_name: subData.last_name,
    display_name: subData.display_name || null,
    phone: normalizeUSPhoneForStorage(subData.phone),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    is_sub: true,
    is_teacher: sub.is_teacher ?? false, // Preserve is_teacher flag
    active: subData.active ?? true,
    school_id: sub.school_id,
  } as Partial<Staff> & { id: string }

  // Generate UUID if not provided
  if (id && id.trim() !== '') {
    insertData.id = id
  } else {
    // Generate UUID - using crypto.randomUUID() which is available in Node.js
    insertData.id = crypto.randomUUID()
  }

  const { data, error } = await supabase.from('staff').insert(insertData).select().single()

  if (error) throw error
  return data as Staff
}

export async function updateSub(id: string, updates: Partial<Staff>) {
  const supabase = await createClient()
  const hasEmailInUpdate = Object.prototype.hasOwnProperty.call(updates, 'email')
  const rawEmail = (updates.email as string | null | undefined) ?? null
  const normalizedEmail = normalizeEmailForStorage(rawEmail)
  if (hasEmailInUpdate && rawEmail && rawEmail.trim() !== '' && !normalizedEmail) {
    throw new Error('Invalid email address')
  }
  const normalizedUpdates = {
    ...updates,
    ...(Object.prototype.hasOwnProperty.call(updates, 'phone')
      ? { phone: normalizeUSPhoneForStorage(updates.phone ?? null) }
      : {}),
    ...(hasEmailInUpdate ? { email: normalizedEmail } : {}),
  }
  const { data, error } = await supabase
    .from('staff')
    .update(normalizedUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Staff
}

export async function deleteSub(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff').delete().eq('id', id)

  if (error) throw error
}
