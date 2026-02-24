import { NextRequest, NextResponse } from 'next/server'
import { deactivateStaff, getStaffById, updateStaff } from '@/lib/api/staff'

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const staff = await getStaffById(id)
    return NextResponse.json(staff)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error) })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const staff = await updateStaff(id, body)
    return NextResponse.json(staff)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error) })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deactivateStaff(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error) })
  }
}
