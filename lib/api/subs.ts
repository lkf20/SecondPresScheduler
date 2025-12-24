import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']

export async function getSubs() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('is_sub', true)
    .order('last_name', { ascending: true })

  if (error) throw error
  return data as Staff[]
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
  email: string
  is_teacher?: boolean
  is_sub: boolean
  active?: boolean
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .insert({
      ...sub,
      is_sub: true,
    })
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

