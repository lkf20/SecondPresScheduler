import { formatUSPhone } from '@/lib/utils/phone'
import { formatGeneratedAt, sanitizeRichTextHtml } from '@/lib/reports/rich-text'
export { formatGeneratedAt, sanitizeRichTextHtml } from '@/lib/reports/rich-text'

type SubRow = {
  id: string
  first_name: string
  last_name: string
  display_name: string | null
  phone: string | null
}

type DayRow = {
  id: string
  name: string
  display_order: number | null
}

type TimeSlotRow = {
  id: string
  code: string
  name: string | null
  display_order: number | null
}

type AvailabilityRow = {
  sub_id: string
  day_of_week_id: string
  time_slot_id: string
  available: boolean | null
}

type ClassGroupRow = {
  id: string
  name: string
  order: number | null
  min_age: number | null
}

type PreferenceRow = {
  sub_id: string
  class_group_id: string | null
  can_teach: boolean | null
}

type SubAvailabilityReportInputs = {
  subs: SubRow[]
  days: DayRow[]
  timeSlots: TimeSlotRow[]
  availabilityRows: AvailabilityRow[]
  classGroups: ClassGroupRow[]
  preferences: PreferenceRow[]
}

type NameFormat = 'display' | 'full'

export type MatrixColumn = {
  dayId: string
  dayName: string
  timeSlotId: string
  timeSlotCode: string
  timeSlotName: string | null
}

type SubAvailabilityReportRow = {
  id: string
  subName: string
  phone: string
  canTeach: string[]
  matrix: Array<{ key: string; available: boolean }>
}

export type SubAvailabilityReportContext = {
  columns: MatrixColumn[]
  dayHeaders: Array<{ dayId: string; dayName: string; colSpan: number }>
  rows: SubAvailabilityReportRow[]
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const truncateForCell = (value: string, max: number) => {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

const sortByOrderThenName = <
  T extends { order?: number | null; display_order?: number | null; name?: string | null },
>(
  a: T,
  b: T
) => {
  const aOrder = a.order ?? a.display_order ?? Number.MAX_SAFE_INTEGER
  const bOrder = b.order ?? b.display_order ?? Number.MAX_SAFE_INTEGER
  if (aOrder !== bOrder) return aOrder - bOrder
  return (a.name ?? '').localeCompare(b.name ?? '')
}

const sortClassGroupsForReport = (a: ClassGroupRow, b: ClassGroupRow) => {
  const aMinAge = a.min_age ?? Number.MAX_SAFE_INTEGER
  const bMinAge = b.min_age ?? Number.MAX_SAFE_INTEGER
  if (aMinAge !== bMinAge) return aMinAge - bMinAge
  const aOrder = a.order ?? Number.MAX_SAFE_INTEGER
  const bOrder = b.order ?? Number.MAX_SAFE_INTEGER
  if (aOrder !== bOrder) return aOrder - bOrder
  return (a.name ?? '').localeCompare(b.name ?? '')
}

const getSubName = (sub: SubRow, nameFormat: NameFormat) => {
  const full = `${sub.first_name} ${sub.last_name}`.trim()
  if (nameFormat === 'full') return full
  const display = sub.display_name?.trim()
  if (display) return display
  return full
}

const matrixKey = (subId: string, dayId: string, timeSlotId: string) =>
  `${subId}|${dayId}|${timeSlotId}`

const normalizeClassGroupBucket = (name: string): string | null => {
  const lower = name.toLowerCase()
  if (/\binfant/.test(lower)) return 'Infants'
  if (/\btoddler/.test(lower)) return 'Toddlers'
  if (/\b2s\b|\btwo\b|\btwos\b/.test(lower)) return '2s'
  if (/\bpreschool\b/.test(lower)) return 'Preschool'
  if (/\bpre[\s-]?k\b|\bprek\b/.test(lower)) return 'Pre-K'
  if (/\borange\b/.test(lower)) return 'Orange'
  return null
}

export const summarizeClassGroupNames = (names: string[]) => {
  const result: string[] = []
  const seen = new Set<string>()

  names.forEach(name => {
    const trimmed = name.trim()
    if (!trimmed) return
    const normalized = normalizeClassGroupBucket(trimmed) ?? trimmed
    if (seen.has(normalized)) return
    seen.add(normalized)
    result.push(normalized)
  })

  return result
}

export function buildSubAvailabilityReportModel(
  inputs: SubAvailabilityReportInputs,
  options?: {
    nameFormat?: NameFormat
  }
): SubAvailabilityReportContext {
  const nameFormat = options?.nameFormat || 'display'
  const sortedDays = [...inputs.days].sort((a, b) => sortByOrderThenName(a, b))
  const sortedTimeSlots = [...inputs.timeSlots].sort((a, b) => sortByOrderThenName(a, b))
  const sortedClassGroups = [...inputs.classGroups].sort(sortClassGroupsForReport)
  const sortedSubs = [...inputs.subs].sort((a, b) =>
    getSubName(a, nameFormat).toLowerCase().localeCompare(getSubName(b, nameFormat).toLowerCase())
  )

  const availabilitySet = new Set<string>()
  inputs.availabilityRows.forEach(row => {
    if (row.available) {
      availabilitySet.add(matrixKey(row.sub_id, row.day_of_week_id, row.time_slot_id))
    }
  })

  const teachableBySub = new Map<string, Set<string>>()
  inputs.preferences.forEach(pref => {
    if (!pref.sub_id || !pref.class_group_id || !pref.can_teach) return
    if (!teachableBySub.has(pref.sub_id)) {
      teachableBySub.set(pref.sub_id, new Set())
    }
    teachableBySub.get(pref.sub_id)?.add(pref.class_group_id)
  })

  const columns: MatrixColumn[] = []
  sortedDays.forEach(day => {
    sortedTimeSlots.forEach(slot => {
      columns.push({
        dayId: day.id,
        dayName: day.name,
        timeSlotId: slot.id,
        timeSlotCode: slot.code,
        timeSlotName: slot.name,
      })
    })
  })

  const dayHeaders = sortedDays.map(day => ({
    dayId: day.id,
    dayName: day.name,
    colSpan: sortedTimeSlots.length,
  }))

  const rows: SubAvailabilityReportRow[] = sortedSubs.map(sub => {
    const teachableIds = teachableBySub.get(sub.id) ?? new Set<string>()
    const canTeachGroups = sortedClassGroups.filter(classGroup => teachableIds.has(classGroup.id))
    const cantTeachGroups = sortedClassGroups.filter(classGroup => !teachableIds.has(classGroup.id))
    const canTeachRaw = canTeachGroups.map(classGroup => classGroup.name)
    const cantTeachRaw = cantTeachGroups.map(classGroup => classGroup.name)
    const summarizedCanTeach = summarizeClassGroupNames(canTeachRaw)
    const summarizedCantTeach = summarizeClassGroupNames(cantTeachRaw)
    const totalClassGroupCount = sortedClassGroups.length
    const canTeachCount = canTeachGroups.length
    const cantTeachCount = cantTeachGroups.length
    const canTeachDisplay =
      totalClassGroupCount > 0 && canTeachCount === totalClassGroupCount
        ? ['All']
        : cantTeachCount > 0 && canTeachCount > cantTeachCount
          ? [`All except ${summarizedCantTeach.join(', ')}`]
          : summarizedCanTeach

    return {
      id: sub.id,
      subName: getSubName(sub, nameFormat),
      phone: formatUSPhone(sub.phone || '') || '—',
      canTeach: canTeachDisplay,
      matrix: columns.map(column => ({
        key: `${column.dayId}|${column.timeSlotId}`,
        available: availabilitySet.has(matrixKey(sub.id, column.dayId, column.timeSlotId)),
      })),
    }
  })

  return { columns, dayHeaders, rows }
}

export function buildSubAvailabilityPdfHtml({
  generatedAt,
  reportContext,
  colorFriendly = true,
  footerNotesHtml = '',
  topHeaderHtml = '',
}: {
  generatedAt: string
  reportContext: SubAvailabilityReportContext
  colorFriendly?: boolean
  footerNotesHtml?: string
  topHeaderHtml?: string
}) {
  const { columns, dayHeaders, rows } = reportContext
  const columnCount = columns.length
  const hasNoScheduleDays = dayHeaders.length === 0
  const hasNoTimeSlots = dayHeaders.some(header => header.colSpan === 0) || columnCount === 0
  const isDense = rows.length > 25 || columnCount > 30
  const showTruncatedWarning = rows.length > 25 || columnCount > 34
  const totalColumns = Math.max(1, columnCount) + 3

  const subColumnWidth = '10%'
  const phoneColumnWidth = '10%'
  const canTeachColumnWidth = '20%'
  const matrixColumnWidth = `${Math.max(1.1, Number((60 / Math.max(1, columnCount)).toFixed(2)))}%`
  const legendItems = columns.reduce<Array<{ code: string; name: string }>>((acc, column) => {
    const existing = acc.find(item => item.code === column.timeSlotCode)
    if (existing) return acc
    acc.push({
      code: column.timeSlotCode,
      name: column.timeSlotName?.trim() || 'Time slot',
    })
    return acc
  }, [])
  const footerNoteRichHtml = sanitizeRichTextHtml(footerNotesHtml)
  const topHeaderRichHtml = sanitizeRichTextHtml(topHeaderHtml, 2000)

  const dayHeaderHtml =
    columnCount === 0
      ? '<th class="day-group" colspan="1">Weekly availability</th>'
      : dayHeaders
          .map(
            (header, index) =>
              `<th class="day-group ${
                index === 0 ? 'edge-divider-left-header' : 'day-sep-header'
              }" colspan="${header.colSpan}">${escapeHtml(header.dayName)}</th>`
          )
          .join('')

  const slotHeaderHtml =
    columnCount === 0
      ? '<th class="slot-header">—</th>'
      : columns
          .map((column, index) => {
            const previous = index > 0 ? columns[index - 1] : null
            const hasDayDivider = previous && previous.dayId !== column.dayId
            return `<th class="slot-header ${
              hasDayDivider ? 'day-sep-header' : ''
            } ${index === 0 ? 'edge-divider-left-header' : ''}">${escapeHtml(column.timeSlotCode)}</th>`
          })
          .join('')

  const rowHtml =
    rows.length === 0
      ? `<tr><td class="empty-message" colspan="${totalColumns}">No active substitutes found.</td></tr>`
      : rows
          .map((row, index) => {
            const canTeachFull = row.canTeach.join(', ')
            const canTeachDisplay =
              canTeachFull.length > 0 ? truncateForCell(canTeachFull, isDense ? 38 : 46) : '—'
            const canTeachHtml = canTeachDisplay.startsWith('All except ')
              ? `<span class="all-except-prefix">All except</span> <span class="all-except-values">${escapeHtml(
                  canTeachDisplay.slice('All except '.length)
                )}</span>`
              : escapeHtml(canTeachDisplay)
            const matrixCells =
              columnCount === 0
                ? '<td class="availability-cell empty-cell">—</td>'
                : row.matrix
                    .map((cell, matrixIndex) => {
                      const previous = matrixIndex > 0 ? columns[matrixIndex - 1] : null
                      const current = columns[matrixIndex]
                      const hasDayDivider = previous && previous.dayId !== current.dayId
                      return `<td class="availability-cell ${hasDayDivider ? 'day-sep' : ''} ${
                        matrixIndex === 0 ? 'edge-divider-left' : ''
                      }" title="${
                        cell.available ? 'Available' : 'Unavailable'
                      }">${cell.available ? '<span class="availability-mark">✓</span>' : ''}</td>`
                    })
                    .join('')

            return `<tr class="${index % 2 === 1 ? 'row-alt' : ''}">
              <td class="sub-name" title="${escapeHtml(row.subName)}">${escapeHtml(
                truncateForCell(row.subName, isDense ? 22 : 28)
              )}</td>
              <td class="text-cell phone-cell" title="${escapeHtml(row.phone)}">${escapeHtml(
                row.phone
              )}</td>
              ${matrixCells}
              <td class="text-cell edge-divider-left" title="${escapeHtml(canTeachFull || '—')}">${canTeachHtml}</td>
            </tr>`
          })
          .join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Sub Availability</title>
    <style>
      @page {
        size: letter landscape;
        margin: 0.22in;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #0f172a;
      }
      .report { width: 100%; }
      .header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: start;
        gap: 10px;
        margin-bottom: 8px;
      }
      .header-left {
        justify-self: start;
        min-width: 0;
      }
      .header-center {
        justify-self: center;
        width: 614px;
        max-width: 100%;
        text-align: center;
      }
      .header-right {
        justify-self: end;
      }
      .title {
        font-size: 18px;
        font-weight: 700;
        margin: 0;
      }
      .meta {
        margin-top: 2px;
        font-size: 11px;
        color: #64748b;
        white-space: nowrap;
      }
      .stats {
        font-size: 11px;
        color: #334155;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th, td { border: 1px solid #e2e8f0; }
      th {
        background: ${colorFriendly ? '#5f97a3' : '#f8fafc'};
        color: ${colorFriendly ? '#ffffff' : '#334155'};
      }
      .row-alt td {
        background: ${colorFriendly ? '#d6e6ea' : '#f8fafc'};
      }
      .row-alt .sub-name {
        background: ${colorFriendly ? '#d6e6ea' : '#f8fafc'};
      }
      .sub-name {
        background: #ffffff;
        color: #334155;
      }
      .sub-header, .phone-header, .do-not-teach-header {
        text-align: left;
        font-size: ${isDense ? '9px' : '10px'};
        font-weight: 700;
        padding: 5px 6px;
      }
      .do-not-teach-header {
        text-align: center;
      }
      .day-group {
        font-size: ${isDense ? '8px' : '9px'};
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-align: center;
        padding: 4px 2px;
      }
      .slot-header {
        font-size: ${isDense ? '8px' : '9px'};
        font-weight: 600;
        text-align: center;
        padding: 4px 2px;
      }
      .day-sep {
        border-left: 2px solid #94a3b8 !important;
      }
      .day-sep-header {
        border-left: 2px solid ${colorFriendly ? '#ffffff' : '#64748b'} !important;
      }
      .edge-divider-left {
        border-left: 2px solid #64748b !important;
      }
      .edge-divider-left-header {
        border-left: 2px solid ${colorFriendly ? '#ffffff' : '#64748b'} !important;
      }
      .all-except-prefix {
        text-decoration: underline;
        font-weight: 700;
      }
      .all-except-values {
        font-style: italic;
      }
      .sub-name {
        font-size: ${isDense ? '9px' : '10px'};
        font-weight: 700;
        padding: 4px 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .availability-cell {
        text-align: center;
        font-size: ${isDense ? '12px' : '13px'};
        line-height: 1;
        padding: 3px 2px;
      }
      .availability-mark {
        color: ${colorFriendly ? '#0f766e' : '#334155'};
        font-weight: 700;
      }
      .empty-cell { color: #94a3b8; }
      .text-cell {
        font-size: ${isDense ? '8.5px' : '9px'};
        padding: 4px 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .phone-cell {
        font-size: ${isDense ? '8px' : '8.5px'};
      }
      .empty-message {
        text-align: center;
        padding: 12px;
        font-size: 10px;
        color: #64748b;
      }
      .footer-warning {
        margin-top: 6px;
        font-size: 9px;
        color: #92400e;
      }
      .legend {
        margin-top: 8px;
        font-size: 10px;
        color: #334155;
      }
      .legend-item {
        margin-right: 10px;
      }
      .footer-note {
        margin-top: 8px;
        background: #ffffff;
        padding: 6px 8px;
        font-size: 10px;
        color: #334155;
        white-space: pre-wrap;
      }
      .header-warning {
        margin-top: 3px;
        font-size: 10px;
        color: #92400e;
      }
    </style>
  </head>
  <body>
    <div class="report">
      <div class="header">
        <div class="header-left">
          <h1 class="title">Sub Availability</h1>
          <div class="meta">Generated ${escapeHtml(generatedAt)}</div>
          ${
            hasNoScheduleDays
              ? '<div class="header-warning">No schedule days are selected in settings. Availability matrix is empty.</div>'
              : ''
          }
          ${
            !hasNoScheduleDays && hasNoTimeSlots
              ? '<div class="header-warning">No active time slots found. Availability matrix is empty.</div>'
              : ''
          }
        </div>
        <div class="header-center">${topHeaderRichHtml || ''}</div>
        <div class="header-right stats">${rows.length} subs</div>
      </div>

      <table>
        <colgroup>
          <col style="width:${subColumnWidth}" />
          <col style="width:${phoneColumnWidth}" />
          ${
            columnCount === 0
              ? '<col style="width:48%" />'
              : columns.map(() => `<col style="width:${matrixColumnWidth}" />`).join('')
          }
          <col style="width:${canTeachColumnWidth}" />
        </colgroup>
        <thead>
          <tr>
            <th class="sub-header" rowspan="2">SUB</th>
            <th class="phone-header" rowspan="2">PHONE</th>
            ${dayHeaderHtml}
            <th class="do-not-teach-header edge-divider-left-header" rowspan="2">Available to teach</th>
          </tr>
          <tr>
            ${slotHeaderHtml}
          </tr>
        </thead>
        <tbody>
          ${rowHtml}
        </tbody>
      </table>
      <div class="legend">
        ${legendItems
          .map(
            item =>
              `<span class="legend-item"><strong>${escapeHtml(item.code)}</strong> = ${escapeHtml(
                item.name
              )}</span>`
          )
          .join('')}
      </div>
      ${footerNoteRichHtml ? `<div class="footer-note">${footerNoteRichHtml}</div>` : ''}

      ${
        showTruncatedWarning
          ? '<div class="footer-warning">Some content truncated for one-page print.</div>'
          : ''
      }
    </div>
  </body>
</html>`
}

export const buildSubAvailabilityFilename = (asOfDate: Date) => {
  const year = asOfDate.getFullYear()
  const month = String(asOfDate.getMonth() + 1).padStart(2, '0')
  const day = String(asOfDate.getDate()).padStart(2, '0')
  return `sub-availability-${year}-${month}-${day}.pdf`
}
