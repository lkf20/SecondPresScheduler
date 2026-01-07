import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'

/**
 * POST /api/setup/profile
 * Create a profile entry for the current authenticated user
 * Links the user to the default school
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json({
        success: true,
        message: 'Profile already exists',
        profile: existingProfile,
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
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Profile created successfully',
      profile: profile,
    })
  } catch (error) {
    console.error('Error setting up profile:', error)
    return createErrorResponse(error, 'Failed to set up profile', 500)
  }
}

/**
 * GET /api/setup/profile
 * Check if current user has a profile
 */
export async function GET(request: NextRequest) {
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

