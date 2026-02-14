import { NextRequest, NextResponse } from 'next/server'
import { createStaff, getStaff } from '@/lib/api/staff'

export async function GET() {
  try {
    const staff = await getStaff()
    return NextResponse.json(staff)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const staff = await createStaff(body)
    return NextResponse.json(staff)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
