import { createClient } from '@/lib/supabase/server'

/**
 * Get the current user's school_id from their profile
 * @returns school_id or null if not found
 */
export async function getUserSchoolId(): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('Error getting user:', userError)
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('Error getting profile:', profileError)
    return null
  }

  return profile.school_id
}

/**
 * Get the current user's ID
 * @returns user_id or null if not found
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('Error getting user:', userError)
    return null
  }

  return user.id
}
