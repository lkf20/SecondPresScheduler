import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('staffing_rules').select('*')

    if (error) throw error

    const rules = data || []
    const classIds = Array.from(
      new Set(rules.map((rule: any) => rule.class_id).filter((id: string | null) => id))
    ) as string[]

    if (classIds.length === 0) {
      return NextResponse.json(rules)
    }

    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name')
      .in('id', classIds)

    if (classesError) throw classesError

    const classNames = Array.from(
      new Set((classes || []).map(cls => cls.name).filter(Boolean))
    )

    let classNameToGroupId = new Map<string, string>()
    if (classNames.length > 0) {
      const { data: classGroups, error: classGroupsError } = await supabase
        .from('class_groups')
        .select('id, name')
        .in('name', classNames)

      if (classGroupsError) throw classGroupsError

      classNameToGroupId = new Map((classGroups || []).map(cg => [cg.name, cg.id]))
    }

    const classIdToGroupId = new Map(
      (classes || [])
        .map(cls => {
          const groupId = classNameToGroupId.get(cls.name)
          return groupId ? [cls.id, groupId] : null
        })
        .filter((entry): entry is [string, string] => Boolean(entry))
    )

    const enriched = rules.map((rule: any) => ({
      ...rule,
      class_group_id: classIdToGroupId.get(rule.class_id) ?? null,
    }))

    return NextResponse.json(enriched)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
