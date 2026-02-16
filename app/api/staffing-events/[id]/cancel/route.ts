import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getUserSchoolId()
    if (!schoolId) {
      return NextResponse.json({ error: 'Missing school context.' }, { status: 403 })
    }

    const { id: eventId } = await params
    if (!eventId) {
      return NextResponse.json({ error: 'Missing event id.' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error: eventError } = await supabase
      .from('staffing_events')
      .update({ status: 'cancelled' })
      .eq('id', eventId)
      .eq('school_id', schoolId)

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    const { error: shiftsError } = await supabase
      .from('staffing_event_shifts')
      .update({ status: 'cancelled' })
      .eq('staffing_event_id', eventId)
      .eq('school_id', schoolId)

    if (shiftsError) {
      return NextResponse.json({ error: shiftsError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
