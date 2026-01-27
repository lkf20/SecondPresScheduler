import { NextRequest, NextResponse } from 'next/server'
import {
  getClassClassroomMappings,
  createClassClassroomMapping,
  bulkCreateClassClassroomMappings,
} from '@/lib/api/class-classroom-mappings'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filters: any = {}
    if (searchParams.get('day_of_week_id')) {
      filters.day_of_week_id = searchParams.get('day_of_week_id')
    }
    if (searchParams.get('time_slot_id')) {
      filters.time_slot_id = searchParams.get('time_slot_id')
    }
    if (searchParams.get('class_group_id')) {
      filters.class_group_id = searchParams.get('class_group_id')
    } else if (searchParams.get('class_id')) {
      // Deprecated: use class_group_id
      filters.class_id = searchParams.get('class_id')
    }
    if (searchParams.get('classroom_id')) {
      filters.classroom_id = searchParams.get('classroom_id')
    }

    const mappings = await getClassClassroomMappings(filters)
    return NextResponse.json(mappings)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if it's a bulk operation
    if (Array.isArray(body.mappings)) {
      const mappings = await bulkCreateClassClassroomMappings(body.mappings)
      return NextResponse.json(mappings, { status: 201 })
    }

    // Single mapping
    const mapping = await createClassClassroomMapping(body)
    return NextResponse.json(mapping, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
