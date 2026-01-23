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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { qualifications } = body // Array of { qualification_id, level?, expires_on?, verified?, notes? }

    if (!Array.isArray(qualifications)) {
      return NextResponse.json({ error: 'Qualifications must be an array' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get existing qualifications for this staff member
    const { data: existing, error: fetchError } = await supabase
      .from('staff_qualifications')
      .select('qualification_id')
      .eq('staff_id', id)

    if (fetchError) throw fetchError

    const existingIds = new Set((existing || []).map((q: any) => q.qualification_id))
    const incomingIds = new Set(qualifications.map((q: any) => q.qualification_id))

    // Delete qualifications that are no longer selected
    const toDelete = Array.from(existingIds).filter(qid => !incomingIds.has(qid))
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('staff_qualifications')
        .delete()
        .eq('staff_id', id)
        .in('qualification_id', toDelete)

      if (deleteError) throw deleteError
    }

    // Upsert qualifications
    for (const qual of qualifications) {
      const { qualification_id, level, expires_on, verified, notes } = qual

      const { error: upsertError } = await supabase.from('staff_qualifications').upsert(
        {
          staff_id: id,
          qualification_id,
          level: level || null,
          expires_on: expires_on || null,
          verified: verified ?? null,
          notes: notes || null,
        },
        {
          onConflict: 'staff_id,qualification_id',
        }
      )

      if (upsertError) throw upsertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving sub qualifications:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
