import { NextRequest, NextResponse } from 'next/server'
import { getSubs, createSub } from '@/lib/api/subs'

export async function GET() {
  try {
    const subs = await getSubs()
    return NextResponse.json(subs)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sub = await createSub(body)
    return NextResponse.json(sub, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

