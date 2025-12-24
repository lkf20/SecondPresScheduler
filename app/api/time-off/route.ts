import { NextRequest, NextResponse } from 'next/server'
import { getTimeOffRequests, createTimeOffRequest } from '@/lib/api/time-off'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filters: any = {}
    if (searchParams.get('teacher_id')) filters.teacher_id = searchParams.get('teacher_id')
    if (searchParams.get('start_date')) filters.start_date = searchParams.get('start_date')
    if (searchParams.get('end_date')) filters.end_date = searchParams.get('end_date')
    
    const requests = await getTimeOffRequests(filters)
    return NextResponse.json(requests)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requestData = await createTimeOffRequest(body)
    return NextResponse.json(requestData, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

