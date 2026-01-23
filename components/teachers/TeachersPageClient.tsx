'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Upload } from 'lucide-react'
import TeacherCSVUploadModal from './TeacherCSVUploadModal'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorMessage from '@/components/shared/ErrorMessage'
import type { StaffWithRole } from '@/lib/api/teachers'

interface TeachersPageClientProps {
  teachers: (StaffWithRole & { role_type_label?: string; full_name?: string })[]
  error: string | null
}

export default function TeachersPageClient({ teachers, error }: TeachersPageClientProps) {
  const router = useRouter()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const columns: Column<StaffWithRole & { role_type_label?: string; full_name?: string }>[] = [
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      linkBasePath: '/teachers',
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
    },
    {
      key: 'phone',
      header: 'Phone',
    },
    {
      key: 'role_type_label',
      header: 'Staff Role',
      sortable: true,
    },
    {
      key: 'active',
      header: 'Status',
    },
    {
      key: 'is_sub',
      header: 'Is Sub?',
      sortable: true,
      cell: row => {
        return row.is_sub ? 'Yes' : 'No'
      },
    },
  ]

  const handleImportComplete = () => {
    router.refresh()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
          <p className="text-muted-foreground mt-2">Manage teacher information and schedules</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </Button>
          <Link href="/teachers/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Teacher
            </Button>
          </Link>
        </div>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <DataTable
        data={teachers}
        columns={columns}
        searchable
        searchPlaceholder="Search teachers..."
        emptyMessage="No teachers found. Add your first teacher to get started."
      />

      <TeacherCSVUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  )
}
