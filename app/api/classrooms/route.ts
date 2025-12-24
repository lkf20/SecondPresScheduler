import { NextRequest, NextResponse } from 'next/server'
import { getClassrooms, createClassroom } from '@/lib/api/classrooms'

export async function GET() {
  try {
    const classrooms = await getClassrooms()
    return NextResponse.json(classrooms)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const classroom = await createClassroom(body)
    return NextResponse.json(classroom, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

