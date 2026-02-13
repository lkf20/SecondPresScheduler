'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { cn } from '@/lib/utils'
import type { StaffWithRole } from '@/lib/api/staff'

interface StaffPageClientProps {
  staff: StaffWithRole[]
  error: string | null
}

type FilterKey = 'permanent' | 'flexible' | 'substitute'

export default function StaffPageClient({ staff, error }: StaffPageClientProps) {
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([])

  const staffWithMeta = useMemo(() => {
    return staff.map(member => {
      const roleAssignments = member.staff_role_type_assignments || []
      const roleCodes = roleAssignments
        .map(assignment => assignment.staff_role_types?.code)
        .filter(Boolean) as string[]
      const roleLabels = roleAssignments
        .map(assignment => assignment.staff_role_types?.label)
        .filter(Boolean) as string[]

      return {
        ...member,
        full_name: member.display_name || `${member.first_name} ${member.last_name}`.trim() || '—',
        role_type_label: roleLabels.length > 0 ? roleLabels.join(', ') : '—',
        role_codes: roleCodes,
        is_permanent: roleCodes.includes('PERMANENT'),
        is_flexible: roleCodes.includes('FLEXIBLE'),
      }
    })
  }, [staff])

  const counts = useMemo(() => {
    return staffWithMeta.reduce(
      (acc, member) => {
        if (member.is_permanent) acc.permanent += 1
        if (member.is_flexible) acc.flexible += 1
        if (member.is_sub) acc.substitute += 1
        return acc
      },
      { permanent: 0, flexible: 0, substitute: 0 }
    )
  }, [staffWithMeta])

  const totalCount = staffWithMeta.length

  const filteredStaff = useMemo(() => {
    if (activeFilters.length === 0) return staffWithMeta
    return staffWithMeta.filter(member => {
      return activeFilters.some(filter => {
        if (filter === 'permanent') return member.is_permanent
        if (filter === 'flexible') return member.is_flexible
        if (filter === 'substitute') return member.is_sub
        return false
      })
    })
  }, [activeFilters, staffWithMeta])

  const columns: Column<(typeof staffWithMeta)[number]>[] = [
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      linkBasePath: '/staff',
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
      cell: row => (row.is_sub ? 'Yes' : 'No'),
    },
  ]

  const toggleFilter = (filter: FilterKey) => {
    setActiveFilters(prev =>
      prev.includes(filter) ? prev.filter(item => item !== filter) : [...prev, filter]
    )
  }

  const clearFilters = () => {
    setActiveFilters([])
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground mt-2">Manage staff information and roles</p>
        </div>
        <Link href="/staff/new">
          <Button>Add Staff</Button>
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeFilters.length === 0 ? 'default' : 'outline'}
          onClick={clearFilters}
          className={cn(activeFilters.length === 0 ? '' : 'text-slate-700')}
        >
          All ({totalCount})
        </Button>
        <Button
          type="button"
          variant={activeFilters.includes('permanent') ? 'default' : 'outline'}
          onClick={() => toggleFilter('permanent')}
          className={cn(activeFilters.includes('permanent') ? '' : 'text-slate-700')}
        >
          Permanent Teachers ({counts.permanent})
        </Button>
        <Button
          type="button"
          variant={activeFilters.includes('flexible') ? 'default' : 'outline'}
          onClick={() => toggleFilter('flexible')}
          className={cn(activeFilters.includes('flexible') ? '' : 'text-slate-700')}
        >
          Flexible Teachers ({counts.flexible})
        </Button>
        <Button
          type="button"
          variant={activeFilters.includes('substitute') ? 'default' : 'outline'}
          onClick={() => toggleFilter('substitute')}
          className={cn(activeFilters.includes('substitute') ? '' : 'text-slate-700')}
        >
          Substitute Teachers ({counts.substitute})
        </Button>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <DataTable
        data={filteredStaff}
        columns={columns}
        searchable
        searchPlaceholder="Search staff..."
        emptyMessage="No staff found. Add your first staff member to get started."
        paginate={false}
      />
    </div>
  )
}
