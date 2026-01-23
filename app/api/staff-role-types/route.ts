import { NextResponse } from 'next/server'
import { getStaffRoleTypes } from '@/lib/api/staff-role-types'

export async function GET() {
  try {
    const roleTypes = await getStaffRoleTypes()
    return NextResponse.json(roleTypes)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
