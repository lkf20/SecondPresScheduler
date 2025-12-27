import { NextRequest, NextResponse } from 'next/server'
import {
  getClassroomAllowedClasses,
  setClassroomAllowedClasses,
} from '@/lib/api/classrooms'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const classIds = await getClassroomAllowedClasses(id)
    return NextResponse.json(classIds)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { class_ids } = body

    if (!Array.isArray(class_ids)) {
      return NextResponse.json(
        { error: 'class_ids must be an array' },
        { status: 400 }
      )
    }

    await setClassroomAllowedClasses(id, class_ids)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

