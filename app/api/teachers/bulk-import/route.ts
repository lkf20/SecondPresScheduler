import { NextRequest, NextResponse } from 'next/server'
import { createTeacher, updateTeacher } from '@/lib/api/teachers'
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

interface Resolution {
  csvIndex: number
  action: 'keep' | 'skip' | 'replace'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teachers, resolutions = [] } = body as {
      teachers: TeacherImport[]
      resolutions?: Resolution[]
    }

    if (!Array.isArray(teachers) || teachers.length === 0) {
      return NextResponse.json(
        { error: 'Teachers array is required and must not be empty' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const results = {
      success: 0,
      replaced: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as Array<{ row: number; message: string }>,
    }

    // Create a map of resolutions by CSV index
    const resolutionMap = new Map<number, 'keep' | 'skip' | 'replace'>()
    resolutions.forEach(r => {
      resolutionMap.set(r.csvIndex, r.action)
    })

    // Process each teacher
    for (let i = 0; i < teachers.length; i++) {
      const teacher = teachers[i]
      const resolution = resolutionMap.get(i) || 'keep'

      // Skip if resolution is 'skip'
      if (resolution === 'skip') {
        results.skipped++
        continue
      }

      try {
        // Find existing teacher (for replace action or to check duplicates)
        let existingTeacher: { id: string } | null = null

        // Check by email first (if provided)
        if (teacher.email && teacher.email.trim()) {
          const { data: existing } = await supabase
            .from('staff')
            .select('id')
            .eq('email', teacher.email.trim().toLowerCase())
            .eq('is_teacher', true)
            .single()

          if (existing) {
            existingTeacher = existing
          }
        }

        // If no email match, check by name
        if (!existingTeacher) {
          const { data: existing } = await supabase
            .from('staff')
            .select('id')
            .eq('first_name', teacher.first_name.trim())
            .eq('last_name', teacher.last_name.trim())
            .eq('is_teacher', true)
            .single()

          if (existing) {
            existingTeacher = existing
          }
        }

        // Handle replace action
        if (resolution === 'replace') {
          if (existingTeacher) {
            // Update existing teacher with all new data
            await updateTeacher(existingTeacher.id, {
              first_name: teacher.first_name,
              last_name: teacher.last_name,
              display_name: teacher.display_name || undefined,
              email: teacher.email || undefined,
              phone: teacher.phone || undefined,
              role_type_id: teacher.role_type_id || undefined,
              is_sub: teacher.is_sub,
              active: teacher.active,
            })
            results.replaced++
            continue
          } else {
            // No existing teacher found, but user selected replace - create new instead
            // This shouldn't normally happen, but handle gracefully
            await createTeacher({
              first_name: teacher.first_name,
              last_name: teacher.last_name,
              display_name: teacher.display_name || undefined,
              email: teacher.email || undefined,
              phone: teacher.phone || undefined,
              role_type_id: teacher.role_type_id || undefined,
              is_teacher: true,
              is_sub: teacher.is_sub,
              active: teacher.active,
            })
            results.success++
            continue
          }
        }

        // Handle keep action (or no resolution specified)
        if (resolution === 'keep' || !resolution) {
          // If existing teacher found but action is 'keep', skip to avoid duplicate
          if (existingTeacher) {
            results.skipped++
            results.errorDetails.push({
              row: i + 2, // +2 because index is 0-based and we skip header row
              message: `Teacher already exists. Use "Replace Existing" to update.`,
            })
            continue
          }

          // Create new teacher
          await createTeacher({
            first_name: teacher.first_name,
            last_name: teacher.last_name,
            display_name: teacher.display_name || undefined,
            email: teacher.email || undefined,
            phone: teacher.phone || undefined,
            role_type_id: teacher.role_type_id || undefined,
            is_teacher: true,
            is_sub: teacher.is_sub,
            active: teacher.active,
          })
          results.success++
        }
      } catch (error: any) {
        // Check if error is "no rows found" (PGRST116) - this is expected when checking for existing
        if (error.code === 'PGRST116') {
          // No existing teacher found, proceed with create
          try {
            await createTeacher({
              first_name: teacher.first_name,
              last_name: teacher.last_name,
              display_name: teacher.display_name || undefined,
              email: teacher.email || undefined,
              phone: teacher.phone || undefined,
              role_type_id: teacher.role_type_id || undefined,
              is_teacher: true,
              is_sub: teacher.is_sub,
              active: teacher.active,
            })
            results.success++
          } catch (createError: any) {
            results.errors++
            results.errorDetails.push({
              row: i + 2,
              message: createError.message || 'Failed to create teacher',
            })
          }
        } else {
          results.errors++
          results.errorDetails.push({
            row: i + 2, // +2 because index is 0-based and we skip header row
            message: error.message || 'Failed to process teacher',
          })
        }
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to import teachers' },
      { status: 500 }
    )
  }
}
