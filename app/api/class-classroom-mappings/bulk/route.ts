import { NextRequest, NextResponse } from 'next/server'
import {
  deleteClassClassroomMappingsByDayTime,
  copyMappingsToOtherDays,
} from '@/lib/api/class-classroom-mappings'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operation, ...params } = body

    switch (operation) {
      case 'delete_by_day_time':
        await deleteClassClassroomMappingsByDayTime(params.day_of_week_id, params.time_slot_id)
        return NextResponse.json({ success: true })

      case 'copy_to_other_days':
        const result = await copyMappingsToOtherDays(
          params.source_day_id,
          params.target_day_ids,
          params.time_slot_id
        )
        return NextResponse.json({ success: true, count: result.length })

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
