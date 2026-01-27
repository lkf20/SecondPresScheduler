import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sub_class_preferences')
      .select('*, class_group:class_groups(*)')
      .eq('sub_id', id)
      .eq('can_teach', true) // Only get preferences where can_teach is true
      .order('class_id', { ascending: true })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching sub preferences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { class_group_ids, class_ids } = body // Array of class group IDs that the sub prefers
    const ids = Array.isArray(class_group_ids) ? class_group_ids : class_ids

    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'class_group_ids must be an array' }, { status: 400 })
    }

    const supabase = await createClient()

    // Delete existing preferences for this sub
    const { error: deleteError } = await supabase
      .from('sub_class_preferences')
      .delete()
      .eq('sub_id', id)

    if (deleteError) throw deleteError

    // Insert new preferences
    if (ids.length > 0) {
      const preferencesData = ids.map((class_group_id: string) => ({
        sub_id: id,
        class_id: class_group_id,
        can_teach: true,
      }))

      const { error: insertError } = await supabase
        .from('sub_class_preferences')
        .insert(preferencesData)

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving sub preferences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
