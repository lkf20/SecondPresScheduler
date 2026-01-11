import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/errors'

/**
 * POST /api/setup/profile
 * Create a profile entry for the current authenticated user
 * Links the user to the default school
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (existingProfile) {
      // Fetch school name for the existing profile
      const { data: school } = await supabase
        .from('schools')
        .select('*')
        .eq('id', existingProfile.school_id)
        .single()

      return NextResponse.json({
        success: true,
        message: 'Profile already exists',
        profile: {
          ...existingProfile,
          schools: school,
        },
      })
    }

    // Get the default school ID
    const { data: defaultSchool } = await supabase
      .from('schools')
      .select('id')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if (!defaultSchool) {
      return NextResponse.json(
        { error: 'Default school not found. Please run migration 034 first.' },
        { status: 404 }
      )
    }

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        school_id: defaultSchool.id,
        role: 'director', // Default role
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Provide more specific error messages
      let errorMessage = 'Unable to create profile'
      if (profileError.code === '23505') {
        errorMessage = 'A profile already exists for this user'
      } else if (profileError.code === '23503') {
        errorMessage = 'Invalid school reference. Please contact support.'
      } else if (profileError.message) {
        errorMessage = profileError.message
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    // Fetch school name for the new profile
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', profile.school_id)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Profile created successfully',
      profile: {
        ...profile,
        schools: school,
      },
    })
  } catch (error) {
    console.error('Error setting up profile:', error)
    // Return a more user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    return NextResponse.json(
      { error: `Unable to create profile: ${errorMessage}` },
      { status: 500 }
    )
  }
}

/**
 * GET /api/setup/profile
 * Check if current user has a profile
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, schools(*)')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // Not found
        return NextResponse.json({
          has_profile: false,
          message: 'Profile does not exist',
        })
      }
      throw profileError
    }

    return NextResponse.json({
      has_profile: true,
      profile: profile,
    })
  } catch (error) {
    console.error('Error checking profile:', error)
    return createErrorResponse(error, 'Failed to check profile', 500)
  }
}
