import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']

export async function getSubs() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('is_sub', true)

  if (error) throw error
  
  // Sort by display_name, falling back to first_name + last_name if display_name is null
  const sorted = (data as Staff[]).sort((a, b) => {
    const nameA = a.display_name || `${a.first_name} ${a.last_name}` || ''
    const nameB = b.display_name || `${b.first_name} ${b.last_name}` || ''
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
}) {
  const supabase = await createClient()
  
  // Exclude id from the insert if it's undefined or empty
  const { id, ...subData } = sub
  const insertData: Partial<Staff> & { id: string } = {
    first_name: subData.first_name,
    last_name: subData.last_name,
    display_name: subData.display_name || null,
    phone: subData.phone || null,
    ...(sub.email && sub.email.trim() !== '' ? { email: sub.email } : {}),
    is_sub: true,
    is_teacher: sub.is_teacher ?? false, // Preserve is_teacher flag
    active: subData.active ?? true,
  } as Partial<Staff> & { id: string }
  
  // Generate UUID if not provided
  if (id && id.trim() !== '') {
    insertData.id = id
  } else {
    // Generate UUID - using crypto.randomUUID() which is available in Node.js
    insertData.id = crypto.randomUUID()
  }
  
  const { data, error } = await supabase
    .from('staff')
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
  return data as Staff
}

export async function updateSub(id: string, updates: Partial<Staff>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .update(updates)
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
