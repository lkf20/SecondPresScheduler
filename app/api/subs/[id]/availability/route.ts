import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch weekly availability
    const { data: weeklyAvailability, error: weeklyError } = await supabase
      .from('sub_availability')
      .select('*, day_of_week:days_of_week(*), time_slot:time_slots(*)')
      .eq('sub_id', id)
      .order('day_of_week_id', { ascending: true })
      .order('time_slot_id', { ascending: true })

    if (weeklyError) throw weeklyError

    // Fetch exception headers
    const { data: exceptionHeaders, error: headersError } = await supabase
      .from('sub_availability_exception_headers')
      .select('*')
      .eq('sub_id', id)
      .order('start_date', { ascending: true })

    if (headersError) throw headersError

    // Fetch expanded exception rows
    const { data: exceptionRows, error: exceptionsError } = await supabase
      .from('sub_availability_exceptions')
      .select('*, time_slot:time_slots(*), exception_header:sub_availability_exception_headers(*)')
      .eq('sub_id', id)
      .not('exception_header_id', 'is', null)
      .order('date', { ascending: true })
      .order('time_slot_id', { ascending: true })

    if (exceptionsError) throw exceptionsError

    return NextResponse.json({
      weekly: weeklyAvailability || [],
      exception_headers: exceptionHeaders || [],
      exception_rows: exceptionRows || [],
    })
  } catch (error: any) {
    console.error('Error fetching sub availability:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { weekly } = body // Array of { day_of_week_id, time_slot_id, available }

    if (!Array.isArray(weekly)) {
      return NextResponse.json({ error: 'Weekly availability must be an array' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: subRow, error: subError } = await supabase
      .from('staff')
      .select('school_id')
      .eq('id', id)
      .single()

    if (subError) throw subError
    const schoolId = subRow?.school_id
    if (!schoolId) {
      return NextResponse.json(
        { error: 'school_id is required for sub availability' },
        { status: 400 }
      )
    }

    // Delete existing weekly availability for this sub
    const { error: deleteError } = await supabase.from('sub_availability').delete().eq('sub_id', id)

    if (deleteError) throw deleteError

    // Insert new weekly availability
    if (weekly.length > 0) {
      const availabilityData = weekly.map((item: any) => ({
        sub_id: id,
        day_of_week_id: item.day_of_week_id,
        time_slot_id: item.time_slot_id,
        available: item.available ?? true,
        school_id: schoolId,
      }))

      const { error: insertError } = await supabase
        .from('sub_availability')
        .insert(availabilityData)

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving sub availability:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
