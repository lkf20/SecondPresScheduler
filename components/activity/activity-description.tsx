import React from 'react'

export type ActivityRow = {
  id: string
  created_at: string
  action: string
  category: string
  entity_type: string
  entity_id: string | null
  details: Record<string, any> | null
  actor_user_id: string | null
  actor_display_name: string
}

type FormatOptions = {
  renderStaffName?: (staffId: string | null | undefined, name: string) => React.ReactNode
  resolveTimeSlotCode?: (timeSlotId: string) => string | null | undefined
}

const ACTION_VERB_MAP: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  assign: 'Assigned',
  unassign: 'Unassigned',
  cancel: 'Cancelled',
  status_change: 'Updated',
}

function toPastTenseVerb(action: string): string {
  const normalized = String(action || '')
    .trim()
    .toLowerCase()
  return ACTION_VERB_MAP[normalized] || 'Updated'
}

function humanizeToken(value: string): string {
  const normalized = String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
  return normalized.length > 0 ? normalized : 'record'
}

export function formatMonthDay(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d)
  const month = date.toLocaleString('en-US', { month: 'long' })
  return `${month} ${date.getDate()}`
}

function formatMonthDayWithYear(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d)
  const month = date.toLocaleString('en-US', { month: 'long' })
  return `${month} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatDateRangeLabel(startDate: string, endDate?: string | null): string {
  const start = String(startDate || '')
  const end = String(endDate || '')
  if (!start) return ''
  if (!end || end === start) return formatMonthDay(start)

  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  if (!sy || !sm || !sd || !ey || !em || !ed) return formatMonthDay(start)

  if (sy === ey && sm === em) {
    const month = new Date(sy, sm - 1, 1).toLocaleString('en-US', { month: 'long' })
    return `${month} ${sd}-${ed}`
  }

  if (sy === ey) {
    return `${formatMonthDay(start)}-${formatMonthDay(end)}`
  }

  return `${formatMonthDayWithYear(start)}-${formatMonthDayWithYear(end)}`
}

function formatTimeOffDateRange(details: Record<string, any>): string {
  const start = details.start_date ?? details.after?.start_date
  const end = details.end_date ?? details.after?.end_date
  if (!start) return ''
  return ` for ${formatDateRangeLabel(start, end)}`
}

function renderTeacher(
  details: Record<string, any>,
  renderStaffName: (staffId: string | null | undefined, name: string) => React.ReactNode
): React.ReactNode {
  const teacherName = details.teacher_name || 'Unknown'
  const teacherId = details.teacher_id ?? null
  return renderStaffName(teacherId, teacherName)
}

function asText(value: React.ReactNode): string {
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(asText).join('')
  if (React.isValidElement(value)) {
    return asText((value.props as { children?: React.ReactNode })?.children)
  }
  return ''
}

function buildSchoolClosureMessage(
  row: ActivityRow,
  details: Record<string, any>,
  verb: string,
  options: FormatOptions
): string {
  const rangeLabel =
    details.start_date && details.end_date
      ? formatDateRangeLabel(details.start_date, details.end_date)
      : details.date
        ? formatDateRangeLabel(details.date)
        : ''
  const base = rangeLabel ? `${verb} school closure for ${rangeLabel}` : `${verb} school closure`
  const reason = typeof details.reason === 'string' && details.reason.trim() ? details.reason : null
  const resolvedSingleTimeSlotCode =
    !details.time_slot_code &&
    typeof details.time_slot_id === 'string' &&
    options.resolveTimeSlotCode
      ? options.resolveTimeSlotCode(details.time_slot_id)
      : null
  const resolvedMultiTimeSlotCodes =
    !details.time_slot_codes && Array.isArray(details.time_slot_ids) && options.resolveTimeSlotCode
      ? details.time_slot_ids
          .map((id: unknown) =>
            typeof id === 'string' ? options.resolveTimeSlotCode?.(id) || null : null
          )
          .filter(Boolean)
      : null
  const slotCodes =
    Array.isArray(details.time_slot_codes) && details.time_slot_codes.length > 0
      ? details.time_slot_codes.filter(Boolean).join(', ')
      : Array.isArray(resolvedMultiTimeSlotCodes) && resolvedMultiTimeSlotCodes.length > 0
        ? resolvedMultiTimeSlotCodes.join(', ')
        : typeof details.time_slot_code === 'string' && details.time_slot_code.trim()
          ? details.time_slot_code.trim()
          : typeof resolvedSingleTimeSlotCode === 'string' && resolvedSingleTimeSlotCode.trim()
            ? resolvedSingleTimeSlotCode.trim()
            : null
  const slotSuffix = details.whole_day === false ? ` ${slotCodes || 'specific time slot'}` : ''
  return `${base}${slotSuffix}${reason ? `: ${reason}` : ''}`
}

export function formatActivityDescription(
  row: ActivityRow,
  options: FormatOptions = {}
): React.ReactNode {
  const details = row.details || {}
  const renderStaffName =
    options.renderStaffName ??
    ((_staffId: string | null | undefined, name: string): React.ReactNode => name)
  const verb = toPastTenseVerb(row.action)

  if (row.category === 'time_off') {
    const teacherPart = details.teacher_name ? (
      <>
        {' for '}
        {renderTeacher(details, renderStaffName)}
      </>
    ) : null
    const dateRange = formatTimeOffDateRange(details)
    if (row.action === 'create') {
      return (
        <>
          Created time off request{teacherPart}
          {dateRange}
        </>
      )
    }
    if (row.action === 'cancel') return <>Cancelled time off request{teacherPart}</>
    if (row.action === 'status_change') {
      const before = details.before?.status ? ` from ${details.before.status}` : ''
      const after = details.after?.status ? ` to ${details.after.status}` : ''
      return (
        <>
          Updated time off request{teacherPart}
          {dateRange}
          {before}
          {after}
        </>
      )
    }
    return (
      <>
        Updated time off request{teacherPart}
        {dateRange}
      </>
    )
  }

  if (row.category === 'sub_assignment') {
    if (row.action === 'assign' && typeof details.summary === 'string' && details.summary.trim()) {
      return details.summary
    }

    const subName = details.sub_name || 'sub'
    const teacherName = details.teacher_name || 'teacher'
    const removedCount =
      typeof details.removed_count === 'number'
        ? details.removed_count
        : Array.isArray(details.assignment_ids)
          ? details.assignment_ids.length
          : null
    const shiftSuffix =
      removedCount && removedCount > 0
        ? ` (${removedCount} shift${removedCount === 1 ? '' : 's'})`
        : ''

    if (row.action === 'unassign') {
      return `Unassigned ${subName} from ${teacherName}${shiftSuffix}`
    }

    const assignedCount = Array.isArray(details.assignment_ids)
      ? details.assignment_ids.length
      : null
    const assignSuffix =
      details.non_sub_override === true
        ? ' (non-sub override)'
        : assignedCount
          ? ` (${assignedCount} shifts)`
          : ''
    return `Assigned sub coverage${assignSuffix}`
  }

  if (row.category === 'temporary_coverage') {
    const teacherPart = renderStaffName(details.teacher_id ?? null, details.teacher_name || 'staff')
    const dateRange =
      details.start_date && details.end_date
        ? ` for ${formatDateRangeLabel(details.start_date, details.end_date)}`
        : ''
    if (row.action === 'assign') {
      const classroom = details.classroom_name
      return classroom ? (
        <>
          Assigned {teacherPart} for temporary coverage in {classroom}
          {dateRange}
        </>
      ) : (
        <>
          Assigned {teacherPart} for temporary coverage
          {dateRange}
        </>
      )
    }
    if (row.action === 'cancel') {
      const count = details.removed_count
      return count ? (
        <>
          Cancelled temporary coverage for {teacherPart} ({count} shift{count !== 1 ? 's' : ''})
        </>
      ) : (
        <>Cancelled temporary coverage for {teacherPart}</>
      )
    }
  }

  if (row.category === 'coverage') {
    const subName = details.sub_name || null
    const teacherName = details.teacher_name || null
    if (row.action === 'assign' && subName && teacherName) {
      return `Assigned coverage override for ${subName} to cover ${teacherName}`
    }
    return `${verb} coverage override`
  }

  if (row.category === 'baseline_schedule') {
    if (row.entity_type === 'schedule_cell') {
      const slotLabel = [details.day_name, details.time_slot_code, details.classroom_name]
        .filter(Boolean)
        .join(' ')
      if (row.action === 'create') {
        return slotLabel ? `Created ${slotLabel}` : 'Created baseline schedule cell'
      }
      if (row.action === 'update') {
        if (details.bulk && details.summary) return `Updated ${details.summary}`
        if (details.bulk && details.cell_count) {
          return `Updated baseline schedule (${details.cell_count} cell${details.cell_count !== 1 ? 's' : ''})`
        }
        return slotLabel ? `Updated ${slotLabel}` : 'Updated baseline schedule cell'
      }
      if (row.action === 'delete') {
        return slotLabel ? `Deactivated ${slotLabel}` : 'Deactivated baseline schedule cell'
      }
    }
    if (row.entity_type === 'teacher_schedule') {
      const teacherPart = renderStaffName(
        details.teacher_id ?? null,
        details.teacher_name ?? 'teacher'
      )
      const slotLabel = [details.classroom_name, details.day_name, details.time_slot_code]
        .filter(Boolean)
        .join(' ')
      if (row.action === 'assign') {
        return slotLabel ? (
          <>
            Assigned {teacherPart} to {slotLabel} baseline schedule
          </>
        ) : (
          <>Assigned {teacherPart} to baseline schedule</>
        )
      }
      if (row.action === 'unassign') {
        return slotLabel ? (
          <>
            Unassigned {teacherPart} from {slotLabel} baseline schedule
          </>
        ) : (
          <>Unassigned {teacherPart} from baseline schedule</>
        )
      }
      if (row.action === 'update') return 'Updated teacher assignment in baseline schedule'
      if (typeof details.reason === 'string' && details.reason.startsWith('conflict_resolution')) {
        return 'Resolved baseline schedule conflict'
      }
    }
  }

  if (row.category === 'school_calendar') {
    if (row.entity_type === 'calendar_settings') {
      if (typeof details.summary === 'string' && details.summary.trim()) {
        return `Updated school calendar settings: ${details.summary}`
      }
      return 'Updated school calendar settings'
    }
    if (row.entity_type === 'school_closure') {
      return buildSchoolClosureMessage(row, details, verb, options)
    }
  }

  const entityLabel = humanizeToken(row.entity_type)
  return `${verb} ${entityLabel}`
}

export function formatActivityDescriptionText(
  row: ActivityRow,
  options: FormatOptions = {}
): string {
  return asText(formatActivityDescription(row, options))
}
