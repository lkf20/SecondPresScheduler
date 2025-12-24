import { NextRequest, NextResponse } from 'next/server'
import { getClasses, createClass } from '@/lib/api/classes'

export async function GET() {
  try {
    const classes = await getClasses()
    return NextResponse.json(classes)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const classData = await createClass(body)
    return NextResponse.json(classData, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

