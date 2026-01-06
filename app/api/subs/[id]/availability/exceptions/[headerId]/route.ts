import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; headerId: string }> }
) {
  try {
    const { id, headerId } = await params
    const supabase = await createClient()

    // Verify the header belongs to this sub
    const { data: header, error: headerError } = await supabase
      .from('sub_availability_exception_headers')
      .select('id')
      .eq('id', headerId)
      .eq('sub_id', id)
      .single()

    if (headerError || !header) {
      return NextResponse.json({ error: 'Exception header not found' }, { status: 404 })
    }

    // Delete expanded exception rows (cascade should handle this, but being explicit)
    const { error: deleteRowsError } = await supabase
      .from('sub_availability_exceptions')
      .delete()
      .eq('exception_header_id', headerId)

    if (deleteRowsError) throw deleteRowsError

    // Delete the header (this should cascade, but being explicit)
    const { error: deleteHeaderError } = await supabase
      .from('sub_availability_exception_headers')
      .delete()
      .eq('id', headerId)

    if (deleteHeaderError) throw deleteHeaderError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting availability exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

