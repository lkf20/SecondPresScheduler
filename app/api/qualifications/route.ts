import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const activeOnly = searchParams.get('active_only') === 'true'

    let query = supabase
      .from('qualification_definitions')
      .select('*')
      .order('category', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching qualifications:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}



