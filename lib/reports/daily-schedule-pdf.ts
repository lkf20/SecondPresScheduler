import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'
import { BREAK_COVERAGE_ENABLED } from '@/lib/feature-flags'
import {
  formatRatioSummary,
  getEnrollmentSummary,
  getYoungestRatioGroup,
} from '@/lib/reports/daily-schedule-metrics'
import { sanitizeRichTextHtml } from '@/lib/reports/rich-text'
import { formatDateISOInTimeZone } from '@/lib/utils/date'
import { getSlotClosureOnDate } from '@/lib/utils/school-closures'

type PdfOptions = {
  showAbsencesAndSubs: boolean
  showEnrollment: boolean
  showNotes?: boolean
  showPreferredRatios: boolean
  showRequiredRatios: boolean
  colorFriendly: boolean
  layout: 'one' | 'two'
  teacherNameFormat: 'default' | 'first_last'
  topHeaderHtml?: string
  footerNotesHtml?: string
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const formatISO = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getSlotCodeCharacters = (code: string | null | undefined) => {
  const normalized = (code ?? '').replace(/\s+/g, '')
  return normalized ? normalized.split('') : ['-']
}

const splitClassroomName = (name: string) => {
  const match = name.match(/\sRoom$/)
  if (!match) return { line1: name, line2: '' }
  const trimmed = name.replace(/\sRoom$/, '')
  return { line1: trimmed, line2: 'Room' }
}

const buildTimeSlots = (data: WeeklyScheduleDataByClassroom[]) => {
  const slots = new Map<
    string,
    {
      id: string
      code: string
      display_order: number | null
      start_time: string | null
      end_time: string | null
    }
  >()

  data.forEach(classroom => {
    classroom.days.forEach(day => {
      day.time_slots.forEach(slot => {
        if (!slots.has(slot.time_slot_id)) {
          slots.set(slot.time_slot_id, {
            id: slot.time_slot_id,
            code: slot.time_slot_code,
            display_order: slot.time_slot_display_order,
            start_time: slot.time_slot_start_time,
            end_time: slot.time_slot_end_time,
          })
        }
      })
    })
  })

  return Array.from(slots.values()).sort(
    (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
  )
}

const getSlotForClassroom = (classroom: WeeklyScheduleDataByClassroom, timeSlotId: string) => {
  const day = classroom.days[0]
  if (!day) return null
  return day.time_slots.find(slot => slot.time_slot_id === timeSlotId) ?? null
}

const sortByName = <T extends { teacher_name?: string | null; teacherName?: string | null }>(
  a: T,
  b: T
) => {
  const nameA = (a.teacher_name ?? a.teacherName ?? '').toLowerCase()
  const nameB = (b.teacher_name ?? b.teacherName ?? '').toLowerCase()
  return nameA.localeCompare(nameB)
}

type TeacherNameSource = {
  teacher_name?: string | null
  teacher_first_name?: string | null
  teacher_last_name?: string | null
  teacher_display_name?: string | null
}

const deriveNameParts = (source: TeacherNameSource) => {
  const display =
    source.teacher_display_name ||
    source.teacher_name ||
    `${source.teacher_first_name || ''} ${source.teacher_last_name || ''}`.trim() ||
    ''
  const first = source.teacher_first_name || ''
  const last = source.teacher_last_name || ''
  if (first || last) {
    return { display, first, last }
  }
  const parts = display.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { display, first: '', last: '' }
  if (parts.length === 1) return { display, first: parts[0], last: '' }
  return { display, first: parts[0], last: parts[parts.length - 1] }
}

const formatTeacherName = (source: TeacherNameSource, format: PdfOptions['teacherNameFormat']) => {
  const { display, first, last } = deriveNameParts(source)
  if (!display) return ''
  if (format === 'default') return display
  return last ? `${first} ${last}` : first
}

export function buildDailySchedulePdfHtml({
  dateISO,
  generatedAt,
  data,
  options,
  timeZone,
  schoolClosures = [],
}: {
  dateISO: string
  generatedAt: string
  data: WeeklyScheduleDataByClassroom[]
  options: PdfOptions
  timeZone: string
  schoolClosures?: Array<{ date: string; time_slot_id: string | null; reason: string | null }>
}) {
  const timeSlots = buildTimeSlots(data)
  const title = formatDateISOInTimeZone(dateISO, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const color = {
    permanent: '#0F172A',
    floater: options.colorFriendly ? '#7E22CE' : '#334155',
    flex: options.colorFriendly ? '#1E40AF' : '#334155',
    tempCoverage: options.colorFriendly ? '#BE185D' : '#334155',
    sub: options.colorFriendly ? '#0F766E' : '#334155',
    absent: '#94A3B8',
    grid: '#64748B',
    header: '#0F172A',
  }
  const timeColWidth = 30
  const fontSize = 11
  const topHeaderRichHtml = sanitizeRichTextHtml(options.topHeaderHtml || '', 2000)
  const footerNotesRichHtml = sanitizeRichTextHtml(options.footerNotesHtml || '', 4000)

  const buildTableHeaders = (classrooms: WeeklyScheduleDataByClassroom[]) =>
    classrooms
      .map(classroom => {
        const split = splitClassroomName(classroom.classroom_name)
        const textColor =
          options.colorFriendly && classroom.classroom_color ? classroom.classroom_color : '#334155'
        return `
          <th style="border:1px solid ${color.grid}; border-bottom:2px solid ${color.grid}; padding:6px; text-align:center; font-size:8px; font-weight:600; color:${textColor}; text-transform: uppercase; letter-spacing: 0.4px;">
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; line-height:1.2; text-align:center;">
              <div>${escapeHtml(split.line1)}</div>
              ${split.line2 ? `<div>${escapeHtml(split.line2)}</div>` : ''}
            </div>
          </th>`
      })
      .join('')

  const buildRows = (classrooms: WeeklyScheduleDataByClassroom[]) =>
    timeSlots
      .map(slot => {
        const slotCodeHtml = getSlotCodeCharacters(slot.code)
          .map(char => `<div>${escapeHtml(char)}</div>`)
          .join('')
        const timeCell = `
        <td style="border:1px solid ${color.grid}; background:#F8FAFC; padding:2px 0; vertical-align:middle; font-size:12px; font-weight:500; color:#475569;">
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; line-height:1.0; font-size:13px; font-weight:600; color:#334155;">
            ${slotCodeHtml}
          </div>
        </td>`

        const slotClosure = getSlotClosureOnDate(dateISO, slot.id, schoolClosures)
        const isSlotClosed = Boolean(slotClosure)

        const cells = isSlotClosed
          ? `
            <td colspan="${Math.max(classrooms.length, 1)}" style="border:1px solid ${color.grid}; background:#f1f5f9; padding:6px; font-size:${fontSize}px; vertical-align:middle; color:#64748B; text-align:center;">
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
                <span style="font-weight:600;">School Closed</span>
                ${
                  slotClosure?.reason?.trim()
                    ? `<span style="margin-top:4px; font-size:10px; font-weight:400; color:#64748B;">${escapeHtml(slotClosure.reason.trim())}</span>`
                    : ''
                }
              </div>
            </td>`
          : classrooms
              .map(classroom => {
                const slotData = getSlotForClassroom(classroom, slot.id)
                const assignments = slotData?.assignments ?? []
                const enrollmentSummary = options.showEnrollment
                  ? getEnrollmentSummary(slotData)
                  : null
                const slotNotes =
                  options.showNotes === true && slotData?.schedule_cell?.is_active
                    ? (slotData?.schedule_cell?.notes?.trim() ?? '')
                    : ''
                const youngestRatioGroup = getYoungestRatioGroup(slotData)
                const absences = slotData?.absences ?? []
                const absentTeacherIds = new Set(absences.map(absence => absence.teacher_id))
                const subs = assignments.filter(a => a.is_substitute)
                const substitutesByAbsentTeacher = new Map<string, typeof subs>()
                subs.forEach(sub => {
                  if (!sub.absent_teacher_id) return
                  if (!substitutesByAbsentTeacher.has(sub.absent_teacher_id)) {
                    substitutesByAbsentTeacher.set(sub.absent_teacher_id, [])
                  }
                  substitutesByAbsentTeacher.get(sub.absent_teacher_id)!.push(sub)
                })
                const regularTeachers = assignments
                  .filter(
                    a =>
                      !a.is_substitute &&
                      !a.is_floater &&
                      !a.is_flexible &&
                      !absentTeacherIds.has(a.teacher_id)
                  )
                  .sort(sortByName)
                const flexTeachers = assignments
                  .filter(
                    a =>
                      !a.is_substitute &&
                      !a.is_floater &&
                      a.is_flexible &&
                      !a.staffing_event_id &&
                      !absentTeacherIds.has(a.teacher_id)
                  )
                  .sort(sortByName)
                const temporaryCoverageTeachers = assignments
                  .filter(
                    a =>
                      !a.is_substitute &&
                      !a.is_floater &&
                      a.is_flexible &&
                      Boolean(a.staffing_event_id) &&
                      !absentTeacherIds.has(a.teacher_id)
                  )
                  .sort(sortByName)
                const floaters = assignments
                  .filter(
                    a => !a.is_substitute && a.is_floater && !absentTeacherIds.has(a.teacher_id)
                  )
                  .sort(sortByName)
                const sortedAbsences = [...absences].sort(sortByName)

                const teacherLines = regularTeachers
                  .map(t => {
                    const breakStr =
                      t.break_start_time && t.break_end_time
                        ? ` <span style="font-size:10px; opacity:0.8;">☕ ${t.break_start_time.slice(0, 5)} - ${t.break_end_time.slice(0, 5)}</span>`
                        : ''
                    return `<div style="color:${color.permanent}; font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">${escapeHtml(
                      formatTeacherName(
                        {
                          teacher_name: t.teacher_name,
                          teacher_first_name: t.teacher_first_name,
                          teacher_last_name: t.teacher_last_name,
                          teacher_display_name: t.teacher_display_name,
                        },
                        options.teacherNameFormat
                      )
                    )}${breakStr}</div>`
                  })
                  .join('')
                const floaterLines = floaters
                  .map(
                    f =>
                      `<div style="color:${color.floater}; font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">${
                        options.colorFriendly ? '' : '↔ '
                      }${escapeHtml(
                        formatTeacherName(
                          {
                            teacher_name: f.teacher_name,
                            teacher_first_name: f.teacher_first_name,
                            teacher_last_name: f.teacher_last_name,
                            teacher_display_name: f.teacher_display_name,
                          },
                          options.teacherNameFormat
                        )
                      )}</div>`
                  )
                  .join('')
                const flexLines = flexTeachers
                  .map(f => {
                    // When Break Coverage feature is off, do not show break prefix in PDF.
                    const prefix =
                      f.event_category === 'break' && BREAK_COVERAGE_ENABLED
                        ? options.colorFriendly
                          ? '[Break] '
                          : '☕ '
                        : options.colorFriendly
                          ? ''
                          : '◦ '
                    return `<div style="color:${color.flex}; font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">${prefix}${escapeHtml(
                      formatTeacherName(
                        {
                          teacher_name: f.teacher_name,
                          teacher_first_name: f.teacher_first_name,
                          teacher_last_name: f.teacher_last_name,
                          teacher_display_name: f.teacher_display_name,
                        },
                        options.teacherNameFormat
                      )
                    )}</div>`
                  })
                  .join('')
                const temporaryCoverageLines = temporaryCoverageTeachers
                  .map(
                    t =>
                      `<div style="color:${color.tempCoverage}; font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">${
                        options.colorFriendly ? '' : '◇ '
                      }${escapeHtml(
                        formatTeacherName(
                          {
                            teacher_name: t.teacher_name,
                            teacher_first_name: t.teacher_first_name,
                            teacher_last_name: t.teacher_last_name,
                            teacher_display_name: t.teacher_display_name,
                          },
                          options.teacherNameFormat
                        )
                      )}</div>`
                  )
                  .join('')
                const absenceLines = options.showAbsencesAndSubs
                  ? sortedAbsences
                      .map(absence => {
                        const subsForAbsence =
                          substitutesByAbsentTeacher.get(absence.teacher_id) || []
                        const isReassigned = absence.is_reassigned === true
                        const subLines = subsForAbsence
                          .map(
                            sub =>
                              `<div style="color:${color.sub}; font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">↳ ${escapeHtml(
                                formatTeacherName(
                                  {
                                    teacher_name: sub.teacher_name,
                                    teacher_first_name: sub.teacher_first_name,
                                    teacher_last_name: sub.teacher_last_name,
                                    teacher_display_name: sub.teacher_display_name,
                                  },
                                  options.teacherNameFormat
                                )
                              )}</div>`
                          )
                          .join('')
                        const noSubLine =
                          !isReassigned && !absence.has_sub && subsForAbsence.length === 0
                            ? options.colorFriendly
                              ? `<div style="color:#B45309; font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">↳ <span style="background:#FEF3C7; color:#92400E; border-radius:2px; padding:1px 4px;">No sub</span></div>`
                              : `<div style="color:#64748B; font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">↳ <span style="background:#F1F5F9; color:#475569; border-radius:2px; padding:1px 4px;">No sub</span></div>`
                            : ''
                        return `
                    <div style="color:${isReassigned ? '#475569' : color.absent}; font-size:10px; font-weight:500; line-height:1.2; margin-bottom:1px;">
                      ${
                        isReassigned
                          ? `<span><span style="text-decoration: line-through;">${escapeHtml(
                              formatTeacherName(
                                {
                                  teacher_name: absence.teacher_name,
                                  teacher_first_name: absence.teacher_first_name,
                                  teacher_last_name: absence.teacher_last_name,
                                  teacher_display_name: absence.teacher_display_name,
                                },
                                options.teacherNameFormat
                              )
                            )}</span> *</span>`
                          : `<span style="text-decoration: line-through;">${escapeHtml(
                              formatTeacherName(
                                {
                                  teacher_name: absence.teacher_name,
                                  teacher_first_name: absence.teacher_first_name,
                                  teacher_last_name: absence.teacher_last_name,
                                  teacher_display_name: absence.teacher_display_name,
                                },
                                options.teacherNameFormat
                              )
                            )}</span>`
                      }
                    </div>
                    ${noSubLine}
                    ${subLines}`
                      })
                      .join('')
                  : ''
                const ratioSummary =
                  (options.showRequiredRatios || options.showPreferredRatios) && youngestRatioGroup
                    ? formatRatioSummary({
                        showRequiredRatios: options.showRequiredRatios,
                        showPreferredRatios: options.showPreferredRatios,
                        requiredRatio: youngestRatioGroup.required_ratio,
                        preferredRatio: youngestRatioGroup.preferred_ratio,
                      })
                    : null
                const metricsLines = [enrollmentSummary, ratioSummary].filter(
                  (line): line is string => typeof line === 'string' && line.length > 0
                )
                const hasTeacherContent = Boolean(
                  teacherLines ||
                  floaterLines ||
                  flexLines ||
                  temporaryCoverageLines ||
                  absenceLines
                )
                const metricsBlock =
                  metricsLines.length > 0
                    ? `<div style="font-size:9px; font-weight:500; line-height:1.2; color:#64748B; background:#F8FAFC; border-radius:2px; padding:4px 6px; margin-left:-2px; margin-right:-2px;${hasTeacherContent ? ' margin-bottom:4px;' : ''}">${metricsLines
                        .map(line => `<div>${escapeHtml(line)}</div>`)
                        .join('')}</div>`
                    : ''
                const notesBlock = slotNotes
                  ? `<div style="margin-top:4px; border-top:1px solid ${color.grid}; padding-top:4px; font-size:9px; line-height:1.2; color:#64748B;">${escapeHtml(slotNotes)}</div>`
                  : ''

                return `
            <td style="border:1px solid ${color.grid}; padding:6px; font-size:${fontSize}px; vertical-align:top;">
              <div style="display:flex; flex-direction:column; gap:0;">
                ${metricsBlock}
                ${teacherLines}
                ${floaterLines}
                ${flexLines}
                ${temporaryCoverageLines}
                ${absenceLines}
                ${notesBlock}
              </div>
            </td>`
              })
              .join('')

        return `<tr>${timeCell}${cells}</tr>`
      })
      .join('')

  const renderTable = (classrooms: WeeklyScheduleDataByClassroom[]) => `
    <table>
      <colgroup>
        <col class="time-col" />
        ${classrooms.map(() => '<col />').join('')}
      </colgroup>
      <thead>
        <tr>
          <th style="border:1px solid ${color.grid}; background:#F8FAFC; padding:2px 0; text-align:center; font-size:12px; font-weight:600; color:#334155;">&nbsp;</th>
          ${buildTableHeaders(classrooms)}
        </tr>
      </thead>
      <tbody>
        ${buildRows(classrooms)}
      </tbody>
    </table>
  `

  const midpoint = Math.ceil(data.length / 2)
  const pageClassrooms =
    options.layout === 'two' ? [data.slice(0, midpoint), data.slice(midpoint)] : [data]

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Daily Schedule</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          col.time-col { width: ${timeColWidth}px; }
          .legend { display: flex; gap: 12px; font-size: 11px; color: #475569; margin-top: 6px; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
        </style>
      </head>
      <body>
        ${pageClassrooms
          .map(
            classrooms => `
              <div class="page" style="padding: 0.25in;">
                <div style="display:grid; grid-template-columns: 1fr auto 1fr; align-items:start; gap:10px; margin-bottom:10px;">
                  <div style="justify-self:start; min-width:0;">
                    <div style="font-size:16px; font-weight:600; margin-bottom:4px;">${escapeHtml(
                      title
                    )}</div>
                    <div style="font-size:10px; font-style:italic; color:#64748B; white-space:nowrap;">
                      Generated by Scheduler · ${escapeHtml(generatedAt)}
                    </div>
                    <div style="font-size:10px; font-style:italic; color:#64748B; white-space:nowrap;">
                      Changes after this time may not be reflected.
                    </div>
                  </div>
                  <div style="justify-self:center; width:614px; max-width:100%; text-align:center;">${
                    topHeaderRichHtml || ''
                  }</div>
                  <div></div>
                </div>
                <div class="legend" style="margin-bottom:14px;">
                  <div style="color:${color.permanent};">Permanent</div>
                  <div style="color:${color.flex};">${
                    options.colorFriendly ? 'Flex' : '◦ Flex'
                  }</div>
                  <div style="color:${color.tempCoverage};">${
                    options.colorFriendly ? 'Temporary Coverage' : '◇ Temporary Coverage'
                  }</div>
                  <div style="color:${color.floater};">${
                    options.colorFriendly ? 'Floater' : '↔ Floater'
                  }</div>
                  <div style="color:${color.sub};">↳ Sub</div>
                  <div style="color:${color.absent}; text-decoration: line-through;">Absent</div>
                  <div style="color:#475569;"><span style="text-decoration: line-through;">Reassigned</span> *</div>
                  ${
                    options.showRequiredRatios && options.showPreferredRatios
                      ? `<div style="color:#64748B;">(R) Required ratio · (P) Preferred ratio</div>`
                      : options.showRequiredRatios
                        ? `<div style="color:#64748B;">(R) Required ratio</div>`
                        : options.showPreferredRatios
                          ? `<div style="color:#64748B;">(P) Preferred ratio</div>`
                          : ''
                  }
                </div>
                ${renderTable(classrooms)}
                ${
                  footerNotesRichHtml
                    ? `<div style="margin-top:8px; padding:6px 8px; font-size:10px; color:#334155; background:#ffffff;">${footerNotesRichHtml}</div>`
                    : ''
                }
              </div>
            `
          )
          .join('')}
      </body>
    </html>
  `
}

export const buildDailyScheduleFilename = (dateISO: string) => {
  const safeDate = dateISO || formatISO(new Date())
  return `daily-schedule-${safeDate}.pdf`
}
