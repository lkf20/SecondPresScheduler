import { NextRequest, NextResponse } from 'next/server'
import { getClassroomAllowedClasses, setClassroomAllowedClasses } from '@/lib/api/classrooms'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const classGroupIds = await getClassroomAllowedClasses(id)
    return NextResponse.json(classGroupIds)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { class_group_ids, class_ids } = body
    const ids = Array.isArray(class_group_ids) ? class_group_ids : class_ids

    if (!Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'class_group_ids must be an array' },
        { status: 400 }
      )
    }

    await setClassroomAllowedClasses(id, ids)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
