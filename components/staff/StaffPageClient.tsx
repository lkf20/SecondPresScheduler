'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeft, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorMessage from '@/components/shared/ErrorMessage'
import ActiveStatusChip from '@/components/settings/ActiveStatusChip'
import type { StaffWithRole } from '@/lib/api/staff'
import {
  buildDuplicateDisplayNameMap,
  computeDisplayName,
  formatStaffDisplayName,
  type DisplayNameFormat,
} from '@/lib/utils/staff-display-name'
import { formatUSPhone } from '@/lib/utils/phone'
import { useSchool } from '@/lib/contexts/SchoolContext'
import { invalidateSchedulingSurfaces } from '@/lib/utils/invalidation'

interface StaffPageClientProps {
  staff: StaffWithRole[]
  error: string | null
  defaultDisplayNameFormat?: DisplayNameFormat
}

type FilterKey = 'permanent' | 'flexible' | 'substitute'
type ClassGroupOption = { id: string; name: string; is_active?: boolean | null }

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

const VALID_FILTERS: FilterKey[] = ['permanent', 'flexible', 'substitute']

function filterFromParam(param: string | null): FilterKey | null {
  if (param && VALID_FILTERS.includes(param as FilterKey)) return param as FilterKey
  return null
}

export default function StaffPageClient({
  staff,
  error,
  defaultDisplayNameFormat,
}: StaffPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const [activeFilter, setActiveFilterState] = useState<FilterKey | null>(() =>
    filterFromParam(searchParams.get('filter'))
  )
  const [includeInactiveStaff, setIncludeInactiveStaffState] = useState(
    () => searchParams.get('inactive') === '1'
  )
  const [staffState, setStaffState] = useState(staff)

  const setActiveFilter = useCallback(
    (value: FilterKey | null) => {
      setActiveFilterState(value)
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set('filter', value)
      else params.delete('filter')
      router.replace(`/staff?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )
  const setIncludeInactiveStaff = useCallback(
    (value: boolean) => {
      setIncludeInactiveStaffState(value)
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set('inactive', '1')
      else params.delete('inactive')
      router.replace(`/staff?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  useEffect(() => {
    const filter = filterFromParam(searchParams.get('filter'))
    const inactive = searchParams.get('inactive') === '1'
    setActiveFilterState(prev => (prev !== filter ? filter : prev))
    setIncludeInactiveStaffState(prev => (prev !== inactive ? inactive : prev))
  }, [searchParams])
  const [defaultFormat, setDefaultFormat] = useState<DisplayNameFormat>(
    defaultDisplayNameFormat ?? 'first_last_initial'
  )
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([])
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [isUpdatingFormat, setIsUpdatingFormat] = useState(false)
  const [displayNameFormatExpanded, setDisplayNameFormatExpanded] = useState(false)
  const [classGroups, setClassGroups] = useState<ClassGroupOption[]>([])
  const [classGroupFilterIds, setClassGroupFilterIdsState] = useState<string[]>(() =>
    searchParams.getAll('cg').filter(Boolean)
  )

  const setClassGroupFilterIds = useCallback(
    (ids: string[]) => {
      setClassGroupFilterIdsState(ids)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('cg')
      ids.forEach(id => params.append('cg', id))
      router.replace(`/staff?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  useEffect(() => {
    const cgIds = searchParams.getAll('cg').filter(Boolean)
    setClassGroupFilterIdsState(prev =>
      prev.length !== cgIds.length || prev.some((id, i) => id !== cgIds[i]) ? cgIds : prev
    )
  }, [searchParams])

  useEffect(() => {
    setStaffState(staff)
  }, [staff])

  useEffect(() => {
    let cancelled = false
    fetch('/api/class-groups?includeInactive=true')
      .then(r => r.json())
      .then((data: ClassGroupOption[]) => {
        if (!cancelled && Array.isArray(data)) setClassGroups(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
      const orderedRoleLabels: string[] = []
      if (roleCodes.includes('PERMANENT')) orderedRoleLabels.push('Permanent')
      if (roleCodes.includes('FLEXIBLE')) orderedRoleLabels.push('Flexible')
      if (member.is_sub) orderedRoleLabels.push('Substitute')

      const { name: computedName, isCustom } = computeDisplayName(member, defaultFormat)

      return {
        ...member,
        full_name: `${member.first_name} ${member.last_name}`.trim() || '—',
        role_type_label: orderedRoleLabels.length > 0 ? orderedRoleLabels.join(', ') : '—',
        ordered_role_labels: orderedRoleLabels,
        role_codes: roleCodes,
        is_permanent: roleCodes.includes('PERMANENT'),
        is_flexible: roleCodes.includes('FLEXIBLE'),
        computed_display_name: computedName,
        is_custom_display_name: isCustom,
      }
    })
  }, [staffState, defaultFormat])

  const visibleStaffPool = useMemo(() => {
    if (includeInactiveStaff) return staffWithMeta
    return staffWithMeta.filter(member => member.active !== false)
  }, [staffWithMeta, includeInactiveStaff])

  const counts = useMemo(() => {
    return visibleStaffPool.reduce(
      (acc, member) => {
        if (member.is_permanent) acc.permanent += 1
        if (member.is_flexible) acc.flexible += 1
        if (member.is_sub) acc.substitute += 1
        return acc
      },
      { permanent: 0, flexible: 0, substitute: 0 }
    )
  }, [visibleStaffPool])

  const totalCount = visibleStaffPool.length

  const filteredByRole = useMemo(() => {
    if (!activeFilter) return visibleStaffPool
    return visibleStaffPool.filter(member => {
      if (activeFilter === 'permanent') return member.is_permanent
      if (activeFilter === 'flexible') return member.is_flexible
      if (activeFilter === 'substitute') return member.is_sub
      return false
    })
  }, [activeFilter, visibleStaffPool])

  const filteredStaff = useMemo(() => {
    if (classGroupFilterIds.length === 0) return filteredByRole
    return filteredByRole.filter(member => {
      const prefs =
        (member as { preferred_class_groups?: { id: string }[] }).preferred_class_groups ?? []
      const prefIds = new Set(prefs.map(p => p.id))
      return classGroupFilterIds.every(id => prefIds.has(id))
    })
  }, [filteredByRole, classGroupFilterIds])

  const duplicateMap = useMemo(
    () => buildDuplicateDisplayNameMap(staffState, defaultFormat),
    [staffState, defaultFormat]
  )
  const duplicateDisplayNameCount = useMemo(
    () => Array.from(duplicateMap.values()).filter(count => count > 1).length,
    [duplicateMap]
  )
  const customNameStaff = useMemo(
    () => staffWithMeta.filter(member => member.is_custom_display_name),
    [staffWithMeta]
  )
  const customNameCount = customNameStaff.length

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

  const handleResetCustomNames = async () => {
    if (customNameCount === 0) return
    const confirmed = window.confirm(
      `Reset ${customNameCount} custom display ${customNameCount === 1 ? 'name' : 'names'} to the default format?`
    )
    if (!confirmed) return
    for (const member of customNameStaff) {
      const computed = formatStaffDisplayName(member, defaultFormat)
      await updateStaffDisplayName(member.id, computed || null)
    }
    await Promise.all([
      invalidateSchedulingSurfaces(queryClient, schoolId, {
        includeFilterOptions: false,
      }),
      queryClient.invalidateQueries({ queryKey: ['staff'] }),
    ])
    router.refresh()
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
      key: 'computed_display_name',
      header: 'Display Name',
      sortable: true,
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
              {Boolean(row.capabilities_notes?.trim()) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-xs font-normal border-slate-200 bg-slate-100 text-slate-600"
                      >
                        Notes
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm whitespace-pre-wrap">
                      {row.capabilities_notes?.trim()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
      sortable: true,
      headerClassName: 'w-[200px]',
      cellClassName: 'w-[200px]',
      cell: row => (row.phone ? formatUSPhone(row.phone) : '—'),
    },
    {
      key: 'role_type_label',
      header: 'Staff Role',
      sortable: true,
      headerClassName: 'w-[200px]',
      cellClassName: 'w-[200px]',
      cell: row => {
        if (!row.ordered_role_labels || row.ordered_role_labels.length === 0) return '—'
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.ordered_role_labels.map(label => {
              if (label === 'Permanent') {
                return (
                  <span
                    key={label}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"
                    style={{ borderColor: '#93c5fd' }}
                  >
                    {label}
                  </span>
                )
              }
              if (label === 'Flexible') {
                return (
                  <span
                    key={label}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-500 border-dashed"
                    style={{ borderColor: '#3b82f6' }}
                  >
                    {label}
                  </span>
                )
              }
              return (
                <span
                  key={label}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-600 border border-teal-200"
                >
                  {label}
                </span>
              )
            })}
          </div>
        )
      },
    },
    {
      key: 'preferred_class_groups',
      header: 'Preferred class groups',
      sortable: false,
      headerClassName: 'w-[240px]',
      cellClassName: 'w-[240px]',
      cell: row => {
        const prefs =
          (row as { preferred_class_groups?: { id: string; name: string }[] })
            .preferred_class_groups ?? []
        // Use only active class groups for "All" check: sub preferences "Select all" is active-only (same as Settings → Class groups default view)
        const activeClassGroupIds = classGroups.filter(c => c.is_active !== false).map(c => c.id)
        const hasAll =
          activeClassGroupIds.length > 0 &&
          prefs.length >= activeClassGroupIds.length &&
          activeClassGroupIds.every(id => prefs.some(p => p.id === id))
        if (prefs.length === 0) return '—'
        if (hasAll) {
          return (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              All
            </span>
          )
        }
        // Sort by Settings → Class groups order (classGroups is already ordered from API)
        const orderIndex = new Map(classGroups.map((c, i) => [c.id, i]))
        const sortedPrefs = [...prefs].sort((a, b) => {
          const i = orderIndex.get(a.id) ?? 9999
          const j = orderIndex.get(b.id) ?? 9999
          if (i !== j) return i - j
          return a.name.localeCompare(b.name)
        })
        return (
          <div className="flex flex-wrap gap-1">
            {sortedPrefs.map(cg => (
              <span
                key={cg.id}
                className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
              >
                {cg.name}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'active',
      header: 'Status',
      sortable: true,
      headerClassName: 'w-[100px]',
      cellClassName: 'w-[100px]',
      cell: row => (
        <div className="w-[100px]">
          <ActiveStatusChip
            isActive={row.active !== false}
            className="w-[72px] shrink-0 justify-center"
          />
        </div>
      ),
    },
  ]

  const toggleFilter = (filter: FilterKey) => {
    setActiveFilter(activeFilter === filter ? null : filter)
  }

  const hasActiveFilters =
    activeFilter !== null || classGroupFilterIds.length > 0 || includeInactiveStaff

  const clearAllFilters = () => {
    setActiveFilterState(null)
    setClassGroupFilterIdsState([])
    setIncludeInactiveStaffState(false)
    router.replace('/staff', { scroll: false })
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground mt-2">Manage staff information and roles</p>
        </div>
        <Link href="/staff/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
        </Link>
      </div>

      <div className="mb-6 rounded-lg border p-4" style={{ backgroundColor: '#f1f5f9' }}>
        <button
          type="button"
          onClick={() => setDisplayNameFormatExpanded(prev => !prev)}
          className="flex w-full items-center gap-6 text-left"
          aria-expanded={displayNameFormatExpanded}
        >
          <span className="text-sm font-medium text-slate-900">Display Name Format</span>
          {!displayNameFormatExpanded && (
            <span className="text-sm text-muted-foreground">
              {formatOptions.find(f => f.value === defaultFormat)?.label ?? defaultFormat}
            </span>
          )}
          {displayNameFormatExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
        </button>
        {displayNameFormatExpanded && (
          <div className="mt-4 space-y-3">
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
                {customNameCount > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="hover:!bg-teal-50"
                      style={{ borderColor: 'rgb(13 148 136)', color: 'rgb(15 118 110)' }}
                      onClick={e => {
                        e.stopPropagation()
                        handleResetCustomNames()
                      }}
                      disabled={isUpdatingFormat || !settingsLoaded}
                    >
                      Reset {customNameCount} Custom {customNameCount === 1 ? 'Name' : 'Names'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {duplicateDisplayNameCount > 0 && (
        <>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {duplicateDisplayNameCount} duplicate display{' '}
            {duplicateDisplayNameCount === 1 ? 'name' : 'names'} detected. Please review display
            names.
          </div>
          <div className="h-6" aria-hidden />
        </>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className={
            activeFilter === null
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
            activeFilter === 'permanent'
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
            activeFilter === 'flexible'
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
            activeFilter === 'substitute'
              ? 'rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
              : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
          }
        >
          Substitute Teachers ({counts.substitute})
        </button>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={
                  classGroupFilterIds.length > 0
                    ? 'inline-flex items-center gap-1.5 min-h-[1.5rem] rounded-full border border-button-fill bg-button-fill px-3 py-1 text-xs font-medium text-button-fill-foreground'
                    : 'inline-flex items-center gap-1.5 min-h-[1.5rem] rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300'
                }
              >
                Preferred class groups
                {classGroupFilterIds.length > 0 && ` (${classGroupFilterIds.length})`}
                <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="max-h-60 overflow-y-auto space-y-2">
                {classGroups
                  .filter(cg => cg.is_active !== false)
                  .map(cg => (
                    <label
                      key={cg.id}
                      className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={classGroupFilterIds.includes(cg.id)}
                        onCheckedChange={checked => {
                          if (checked === true) {
                            setClassGroupFilterIds([...classGroupFilterIds, cg.id])
                          } else {
                            setClassGroupFilterIds(classGroupFilterIds.filter(id => id !== cg.id))
                          }
                        }}
                      />
                      <span className="text-sm">{cg.name}</span>
                    </label>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
              onClick={clearAllFilters}
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              Clear all filters
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 pl-2">
          <Switch
            id="include-inactive-staff"
            checked={includeInactiveStaff}
            onCheckedChange={checked => setIncludeInactiveStaff(checked === true)}
          />
          <Label htmlFor="include-inactive-staff" className="text-sm font-normal cursor-pointer">
            Show inactive
          </Label>
        </div>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="rounded-lg border bg-white p-4">
        <DataTable
          data={filteredStaff}
          fixedLayout={false}
          columns={columns}
          searchable
          searchPlaceholder="Search staff..."
          emptyMessage="No staff found. Add your first staff member to get started."
          paginate={false}
          cellClassName="text-base"
          initialSortKey="full_name"
          initialSortDirection="asc"
          onRowClick={row => router.push(`/staff/${row.id as string}?${searchParams.toString()}`)}
        />
      </div>
    </div>
  )
}
