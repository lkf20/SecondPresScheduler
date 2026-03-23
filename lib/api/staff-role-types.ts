import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type StaffRoleType = Database['public']['Tables']['staff_role_types']['Row']

/**
 * Active role types for a single school. Rows are tenant-scoped (`school_id`); uniqueness is
 * `(school_id, code)` (migration 066). ADMIN is seeded per school in migration 120.
 *
 * **RLS:** Policies on `staff_role_types` allow any authenticated user to SELECT all rows
 * (`USING (true)` in migration 008). This helper must always filter by `schoolId` so clients
 * never receive another school’s role type ids.
 */
export async function getStaffRoleTypes(schoolId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff_role_types')
    .select('*')
    .eq('school_id', schoolId)
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data as StaffRoleType[]
}
