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
      .order('class_group_id', { ascending: true })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching sub preferences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
