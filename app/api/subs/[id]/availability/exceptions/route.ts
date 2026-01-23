import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { start_date, end_date, available, time_slot_ids } = body

    if (
      !start_date ||
      !end_date ||
      typeof available !== 'boolean' ||
      !Array.isArray(time_slot_ids)
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: start_date, end_date, available, time_slot_ids' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Create exception header
    const { data: header, error: headerError } = await supabase
      .from('sub_availability_exception_headers')
      .insert({
        sub_id: id,
        start_date,
        end_date,
        available,
      })
      .select()
      .single()

    if (headerError) throw headerError

    // Generate all dates in the range
    const start = new Date(start_date)
    const end = new Date(end_date)
    const dates: string[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Skip weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = d.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(d.toISOString().split('T')[0])
      }
    }

    // Create expanded exception rows for each date × time slot
    const exceptionRows = []
    for (const date of dates) {
      for (const time_slot_id of time_slot_ids) {
        exceptionRows.push({
          sub_id: id,
          date,
          time_slot_id,
          available,
          exception_header_id: header.id,
        })
      }
    }

    if (exceptionRows.length > 0) {
      const { error: rowsError } = await supabase
        .from('sub_availability_exceptions')
        .insert(exceptionRows)

      if (rowsError) throw rowsError
    }

    return NextResponse.json({ success: true, header_id: header.id })
  } catch (error: any) {
    console.error('Error creating availability exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
