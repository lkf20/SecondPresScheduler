import { NextResponse } from 'next/server'
import { getDaysOfWeek, ensureDaysOfWeekSeeded } from '@/lib/api/days-of-week'

export async function GET() {
  try {
    // Try to ensure days are seeded (will only insert if table is empty)
    await ensureDaysOfWeekSeeded()
    
    // Fetch days
    const days = await getDaysOfWeek()
    
    if (!days || days.length === 0) {
      console.warn('No days of week found in database after seeding attempt')
      return NextResponse.json([])
    }

    return NextResponse.json(days)
  } catch (error: any) {
    console.error('Unexpected error in days-of-week API:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

