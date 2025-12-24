import { NextRequest, NextResponse } from 'next/server'
import { getTeachers, createTeacher } from '@/lib/api/teachers'

export async function GET() {
  try {
    const teachers = await getTeachers()
    return NextResponse.json(teachers)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const teacher = await createTeacher(body)
    return NextResponse.json(teacher, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

