import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

export async function getStaffRoleTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff_role_types')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data as StaffRoleType[]
}
