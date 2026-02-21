import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getErrorStatus(error: unknown): number {
  const maybeError = error as { code?: string; message?: string } | undefined
  const code = maybeError?.code
  const message = maybeError?.message?.toLowerCase() || ''

  if (code === 'P0002') return 404
  if (code === '23505' || code === '23514') return 409
  if (code === '22P02' || code === '23502' || code === '23503') return 400
  if (message.includes('not found')) return 404

  return 500
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { class_group_ids, qualifications, capabilities } = body

    if (!Array.isArray(class_group_ids)) {
      return NextResponse.json({ error: 'class_group_ids must be an array' }, { status: 400 })
    }

    if (!Array.isArray(qualifications)) {
      return NextResponse.json({ error: 'qualifications must be an array' }, { status: 400 })
    }

    if (!capabilities || typeof capabilities !== 'object') {
      return NextResponse.json({ error: 'capabilities must be an object' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('save_sub_preferences_bundle', {
      p_sub_id: id,
      p_class_group_ids: class_group_ids,
      p_qualifications: qualifications,
      p_capabilities: capabilities,
    })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error) })
  }
}
