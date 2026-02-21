import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('staff_qualifications')
      .select('*, qualification:qualification_definitions(*)')
      .eq('staff_id', id)
      .order('qualification_id', { ascending: true })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching sub qualifications:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
