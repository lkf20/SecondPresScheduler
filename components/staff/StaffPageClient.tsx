'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorMessage from '@/components/shared/ErrorMessage'
import type { StaffWithRole } from '@/lib/api/staff'
import {
  buildDuplicateDisplayNameMap,
  computeDisplayName,
  formatStaffDisplayName,
  type DisplayNameFormat,
} from '@/lib/utils/staff-display-name'

interface StaffPageClientProps {
  staff: StaffWithRole[]
  error: string | null
}

type FilterKey = 'permanent' | 'flexible' | 'substitute'

type ScheduleSettingsResponse = {
  selected_day_ids?: string[]
  default_display_name_format?: DisplayNameFormat
}

const formatOptions: Array<{ value: DisplayNameFormat; label: string }> = [
  { value: 'first_last_initial', label: 'First + Last Initial' },
  { value: 'first_initial_last', label: 'First Initial + Last' },
  { value: 'first_last', label: 'First + Last' },
  { value: 'first_name', label: 'First Name' },
]

export default function StaffPageClient({ staff, error }: StaffPageClientProps) {
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([])
  const [staffState, setStaffState] = useState(staff)
  const [defaultFormat, setDefaultFormat] = useState<DisplayNameFormat>('first_last_initial')
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([])
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [isUpdatingFormat, setIsUpdatingFormat] = useState(false)

  useEffect(() => {
    setStaffState(staff)
  }, [staff])

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/schedule-settings')
        if (!response.ok) return
        const data = (await response.json()) as ScheduleSettingsResponse
        if (Array.isArray(data.selected_day_ids)) {
          setSelectedDayIds(data.selected_day_ids)
        }
        if (data.default_display_name_format) {
          setDefaultFormat(data.default_display_name_format)
        }
        setSettingsLoaded(true)
      } catch (err) {
        console.error('Failed to fetch schedule settings', err)
        setSettingsLoaded(true)
      }
    }

    fetchSettings()
  }, [])

  const staffWithMeta = useMemo(() => {
    return staffState.map(member => {
      const roleAssignments = member.staff_role_type_assignments || []
      const roleCodes = roleAssignments
        .map(assignment => assignment.staff_role_types?.code)
        .filter(Boolean) as string[]
      const roleLabels = roleAssignments
        .map(assignment => assignment.staff_role_types?.label)
        .filter(Boolean) as string[]

      const { name: computedName, isCustom } = computeDisplayName(member, defaultFormat)

      return {
        ...member,
        full_name: `${member.first_name} ${member.last_name}`.trim() || '—',
        role_type_label: roleLabels.length > 0 ? roleLabels.join(', ') : '—',
        role_codes: roleCodes,
        is_permanent: roleCodes.includes('PERMANENT'),
        is_flexible: roleCodes.includes('FLEXIBLE'),
        computed_display_name: computedName,
        is_custom_display_name: isCustom,
      }
    })
  }, [staffState, defaultFormat])

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

  const duplicateMap = useMemo(
    () => buildDuplicateDisplayNameMap(staffState, defaultFormat),
    [staffState, defaultFormat]
  )

  const updateDefaultFormat = async (nextFormat: DisplayNameFormat) => {
    if (!settingsLoaded) return
    setDefaultFormat(nextFormat)
    setIsUpdatingFormat(true)
    try {
      await fetch('/api/schedule-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_day_ids: selectedDayIds,
          default_display_name_format: nextFormat,
        }),
      })
    } catch (err) {
      console.error('Failed to update display name format', err)
    } finally {
      setIsUpdatingFormat(false)
    }
  }

  const updateStaffDisplayName = async (id: string, displayName: string | null) => {
    const response = await fetch(`/api/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update display name')
    }
    setStaffState(prev =>
      prev.map(member => (member.id === id ? { ...member, display_name: displayName } : member))
    )
  }

  const handleApplyAll = async () => {
    const confirmed = window.confirm('This will overwrite all custom display names. Continue?')
    if (!confirmed) return
    for (const member of staffState) {
      const computed = formatStaffDisplayName(member, defaultFormat)
      if (!computed) continue
      await updateStaffDisplayName(member.id, computed)
    }
  }

  const previewTarget = staffState.find(member => Boolean(member.first_name))
  const previewName = previewTarget ? formatStaffDisplayName(previewTarget, defaultFormat) : ''

  const columns: Column<(typeof staffWithMeta)[number]>[] = [
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      linkBasePath: '/staff',
    },
    {
      key: 'display_name',
      header: 'Display Name',
      cell: row => {
        const computedName = row.computed_display_name || ''
        const duplicateCount = computedName ? duplicateMap.get(computedName.toLowerCase()) || 0 : 0
        const isDuplicate = duplicateCount > 1
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{computedName || '—'}</span>
              {row.is_custom_display_name && (
                <Badge
                  variant="outline"
                  className="text-xs font-normal border-slate-200 bg-slate-100 text-slate-500"
                >
                  Custom
                </Badge>
              )}
              {isDuplicate && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-amber-600">⚠️</span>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate display name</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        )
      },
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

      <div className="mb-8 space-y-4 rounded-lg border bg-white p-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-900">Display Name Format</p>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={defaultFormat}
              onValueChange={value => updateDefaultFormat(value as DisplayNameFormat)}
            >
              <SelectTrigger className="w-56" disabled={!settingsLoaded || isUpdatingFormat}>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center">
              <span className="text-sm text-muted-foreground">
                {previewName ? `Preview: ${previewName}` : 'Preview unavailable'}
              </span>
              <div className="w-12" />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="default"
                  onClick={handleApplyAll}
                  disabled={isUpdatingFormat || !settingsLoaded}
                >
                  Apply to all
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={clearFilters}
          className={
            activeFilters.length === 0
              ? 'rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
              : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
          }
        >
          All ({totalCount})
        </button>
        <button
          type="button"
          onClick={() => toggleFilter('permanent')}
          className={
            activeFilters.includes('permanent')
              ? 'rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
              : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
          }
        >
          Permanent Teachers ({counts.permanent})
        </button>
        <button
          type="button"
          onClick={() => toggleFilter('flexible')}
          className={
            activeFilters.includes('flexible')
              ? 'rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
              : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
          }
        >
          Flexible Teachers ({counts.flexible})
        </button>
        <button
          type="button"
          onClick={() => toggleFilter('substitute')}
          className={
            activeFilters.includes('substitute')
              ? 'rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
              : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
          }
        >
          Substitute Teachers ({counts.substitute})
        </button>
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
