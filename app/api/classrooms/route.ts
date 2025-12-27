import { NextRequest, NextResponse } from 'next/server'
import {
  getClassrooms,
  createClassroom,
  setClassroomAllowedClasses,
} from '@/lib/api/classrooms'

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
    const { allowed_classes, ...classroomData } = body

    // Create the classroom
    const classroom = await createClassroom(classroomData)

    // Set allowed classes if provided
    if (allowed_classes && Array.isArray(allowed_classes)) {
      await setClassroomAllowedClasses(classroom.id, allowed_classes)
    }

    return NextResponse.json(classroom, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}



