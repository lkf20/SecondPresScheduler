import { NextRequest, NextResponse } from 'next/server'
import { getTeacherScheduledShifts } from '@/lib/api/time-off-shifts'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date query parameters are required' },
        { status: 400 }
      )
    }
    
    const shifts = await getTeacherScheduledShifts(id, startDate, endDate)
    return NextResponse.json(shifts)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

