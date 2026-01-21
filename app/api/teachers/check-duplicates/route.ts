import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface TeacherImport {
  first_name: string
  last_name: string
  display_name?: string | null
  email?: string | null
  phone?: string | null
  role_type_id?: string | null
  active: boolean
  is_sub: boolean
  is_teacher: boolean
}

interface DuplicateMatch {
  csvIndex: number
  csvTeacher: TeacherImport
  matchType: 'email' | 'name' | 'both'
  existingTeacher?: {
    id: string
    first_name: string
    last_name: string
    display_name: string | null
    email: string | null
    phone: string | null
  }
  withinCsv?: number[] // Other CSV row indices that match
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teachers } = body as { teachers: TeacherImport[] }

    if (!Array.isArray(teachers) || teachers.length === 0) {
      return NextResponse.json(
        { error: 'Teachers array is required and must not be empty' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const duplicates: DuplicateMatch[] = []

    // Get all existing teachers
    const { data: existingTeachers } = await supabase
      .from('staff')
      .select('id, first_name, last_name, display_name, email, phone')
      .eq('is_teacher', true)

    // Check for duplicates within CSV
    const csvEmailMap = new Map<string, number[]>()
    const csvNameMap = new Map<string, number[]>()

    teachers.forEach((teacher, index) => {
      // Track by email
      if (teacher.email && teacher.email.trim()) {
        const emailKey = teacher.email.toLowerCase().trim()
        if (!csvEmailMap.has(emailKey)) {
          csvEmailMap.set(emailKey, [])
        }
        csvEmailMap.get(emailKey)!.push(index)
      }

      // Track by name
      const nameKey = `${(teacher.first_name || '').toLowerCase().trim()} ${(teacher.last_name || '').toLowerCase().trim()}`.trim()
      if (nameKey) {
        if (!csvNameMap.has(nameKey)) {
          csvNameMap.set(nameKey, [])
        }
        csvNameMap.get(nameKey)!.push(index)
      }
    })

    // Check each teacher for duplicates
    teachers.forEach((teacher, csvIndex) => {
      let matchType: 'email' | 'name' | 'both' | null = null
      let existingTeacher: DuplicateMatch['existingTeacher'] | null = null

      // Check email match
      if (teacher.email && teacher.email.trim()) {
        const emailKey = teacher.email.toLowerCase().trim()
        
        // Check within CSV
        const csvEmailMatches = csvEmailMap.get(emailKey) || []
        if (csvEmailMatches.length > 1) {
          const withinCsv = csvEmailMatches.filter(i => i !== csvIndex)
          if (withinCsv.length > 0) {
            // This will be handled when we process the other row
            // For now, we'll mark this as a duplicate
          }
        }

        // Check against database
        const dbMatch = existingTeachers?.find(
          (et) => et.email && et.email.toLowerCase().trim() === emailKey
        )
        if (dbMatch) {
          matchType = 'email'
          existingTeacher = dbMatch
        }
      }

      // Check name match (if no email match or email not provided)
      if (!existingTeacher) {
        const nameKey = `${(teacher.first_name || '').toLowerCase().trim()} ${(teacher.last_name || '').toLowerCase().trim()}`.trim()
        
        if (nameKey) {
          // Check within CSV
          const csvNameMatches = csvNameMap.get(nameKey) || []
          if (csvNameMatches.length > 1) {
            const withinCsv = csvNameMatches.filter(i => i !== csvIndex)
            if (withinCsv.length > 0 && !existingTeacher) {
              // Name match within CSV - we'll handle this
            }
          }

          // Check against database
          const dbMatch = existingTeachers?.find(
            (et) => {
              const etNameKey = `${(et.first_name || '').toLowerCase().trim()} ${(et.last_name || '').toLowerCase().trim()}`.trim()
              return etNameKey === nameKey
            }
          )
          if (dbMatch) {
            matchType = matchType === 'email' ? 'both' : 'name'
            existingTeacher = dbMatch
          }
        }
      }

      // If we have both email and name matches, check if they're the same teacher
      if (teacher.email && teacher.email.trim()) {
        const emailKey = teacher.email.toLowerCase().trim()
        const nameKey = `${(teacher.first_name || '').toLowerCase().trim()} ${(teacher.last_name || '').toLowerCase().trim()}`.trim()
        
        const emailMatch = existingTeachers?.find(
          (et) => et.email && et.email.toLowerCase().trim() === emailKey
        )
        const nameMatch = existingTeachers?.find(
          (et) => {
            const etNameKey = `${(et.first_name || '').toLowerCase().trim()} ${(et.last_name || '').toLowerCase().trim()}`.trim()
            return etNameKey === nameKey
          }
        )

        if (emailMatch && nameMatch && emailMatch.id === nameMatch.id) {
          matchType = 'both'
          existingTeacher = emailMatch
        } else if (emailMatch) {
          matchType = 'email'
          existingTeacher = emailMatch
        } else if (nameMatch) {
          matchType = 'name'
          existingTeacher = nameMatch
        }
      } else {
        // No email, check name only
        const nameKey = `${(teacher.first_name || '').toLowerCase().trim()} ${(teacher.last_name || '').toLowerCase().trim()}`.trim()
        const nameMatch = existingTeachers?.find(
          (et) => {
            const etNameKey = `${(et.first_name || '').toLowerCase().trim()} ${(et.last_name || '').toLowerCase().trim()}`.trim()
            return etNameKey === nameKey
          }
        )
        if (nameMatch) {
          matchType = 'name'
          existingTeacher = nameMatch
        }
      }

      // Check for within-CSV duplicates
      const withinCsv: number[] = []
      if (teacher.email && teacher.email.trim()) {
        const emailMatches = csvEmailMap.get(teacher.email.toLowerCase().trim()) || []
        withinCsv.push(...emailMatches.filter(i => i !== csvIndex))
      }
      const nameKey = `${(teacher.first_name || '').toLowerCase().trim()} ${(teacher.last_name || '').toLowerCase().trim()}`.trim()
      if (nameKey) {
        const nameMatches = csvNameMap.get(nameKey) || []
        const nameDups = nameMatches.filter(i => i !== csvIndex && !withinCsv.includes(i))
        withinCsv.push(...nameDups)
      }

      // Only add to duplicates if there's an existing teacher match OR within-CSV duplicates
      // If only within-CSV duplicates, we still want to show it but existingTeacher will be undefined
      if (existingTeacher || withinCsv.length > 0) {
        duplicates.push({
          csvIndex,
          csvTeacher: teacher,
          matchType: matchType || (withinCsv.length > 0 ? 'name' : 'email'),
          existingTeacher: existingTeacher || undefined,
          withinCsv: withinCsv.length > 0 ? withinCsv : undefined,
        })
      }
    })

    return NextResponse.json({ duplicates })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to check duplicates' },
      { status: 500 }
    )
  }
}
