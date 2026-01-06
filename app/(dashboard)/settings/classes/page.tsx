import Link from 'next/link'
import { getClassGroups, updateClassGroup } from '@/lib/api/class-groups'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Database } from '@/types/database'
import ErrorMessage from '@/components/shared/ErrorMessage'
import SortableClassesTable from '@/components/settings/SortableClassesTable'

type ClassGroup = Database['public']['Tables']['class_groups']['Row']

export default async function ClassesPage() {
  let classGroups: ClassGroup[] = []
  let error: string | null = null

  try {
    // Fetch all class groups (including inactive) for the list view
    classGroups = await getClassGroups(true)
  } catch (err: any) {
    error = err.message || 'Failed to load class groups'
    console.error('Error loading class groups:', err)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Class Groups</h1>
          <p className="text-muted-foreground mt-2">
            Manage class group names. Drag rows to reorder.
          </p>
        </div>
        <div className="flex-shrink-0">
          <Link href="/settings/classes/new">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Class Group
            </Button>
          </Link>
        </div>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <SortableClassesTable classes={classGroups} />
    </div>
  )
}
