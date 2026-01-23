import { NextRequest, NextResponse } from 'next/server'
import {
  getClassroomById,
  updateClassroom,
  deleteClassroom,
  setClassroomAllowedClasses,
} from '@/lib/api/classrooms'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const classroom = await getClassroomById(id)
    return NextResponse.json(classroom)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { allowed_classes, ...classroomData } = body

    // Update the classroom
    const classroom = await updateClassroom(id, classroomData)

    // Update allowed classes if provided
    if (allowed_classes !== undefined) {
      await setClassroomAllowedClasses(id, Array.isArray(allowed_classes) ? allowed_classes : [])
    }

    return NextResponse.json(classroom)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteClassroom(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
