import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sub_class_preferences')
      .select('*, class:classes(id, name)')
      .eq('sub_id', id)
      .eq('can_teach', true) // Only get preferences where can_teach is true
      .order('class_id', { ascending: true })

    if (error) throw error

    const classNames = Array.from(
      new Set(
        (data || [])
          .map((pref: any) => pref.class?.name)
          .filter((name: string | null | undefined): name is string => Boolean(name))
      )
    )

    let classGroupMap = new Map<string, { id: string; name: string }>()
    if (classNames.length > 0) {
      const { data: classGroups, error: classGroupsError } = await supabase
        .from('class_groups')
        .select('id, name')
        .in('name', classNames)

      if (classGroupsError) throw classGroupsError

      classGroupMap = new Map((classGroups || []).map(cg => [cg.name, cg]))
    }

    const enriched = (data || []).map((pref: any) => {
      const className = pref.class?.name
      const classGroup = className ? classGroupMap.get(className) : null
      return {
        ...pref,
        class_group_id: classGroup?.id ?? null,
        class_group: classGroup ?? null,
      }
    })

    return NextResponse.json(enriched)
  } catch (error: any) {
    console.error('Error fetching sub preferences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { class_group_ids, class_ids } = body // Array of class group IDs that the sub prefers
    const ids = Array.isArray(class_group_ids) ? class_group_ids : class_ids

    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'class_group_ids must be an array' }, { status: 400 })
    }

    const supabase = await createClient()

    let classIdsToStore = ids
    if (Array.isArray(class_group_ids)) {
      const { data: classGroups, error: classGroupsError } = await supabase
        .from('class_groups')
        .select('id, name')
        .in('id', class_group_ids)

      if (classGroupsError) throw classGroupsError

      const classGroupNames = Array.from(
        new Set((classGroups || []).map(cg => cg.name).filter(Boolean))
      )

      let classNameToId = new Map<string, string>()
      if (classGroupNames.length > 0) {
        const { data: classes, error: classesError } = await supabase
          .from('classes')
          .select('id, name')
          .in('name', classGroupNames)

        if (classesError) throw classesError

        classNameToId = new Map((classes || []).map(cls => [cls.name, cls.id]))
      }

      classIdsToStore = (classGroups || [])
        .map(cg => classNameToId.get(cg.name))
        .filter((id): id is string => Boolean(id))
    }

    // Delete existing preferences for this sub
    const { error: deleteError } = await supabase
      .from('sub_class_preferences')
      .delete()
      .eq('sub_id', id)

    if (deleteError) throw deleteError

    // Insert new preferences
    if (classIdsToStore.length > 0) {
      const preferencesData = classIdsToStore.map((class_id: string) => ({
        sub_id: id,
        class_id,
        can_teach: true,
      }))

      const { error: insertError } = await supabase
        .from('sub_class_preferences')
        .insert(preferencesData)

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving sub preferences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
