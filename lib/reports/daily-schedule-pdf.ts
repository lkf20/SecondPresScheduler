import type { WeeklyScheduleDataByClassroom } from '@/lib/api/weekly-schedule'

type PdfOptions = {
  showAbsencesAndSubs: boolean
  colorFriendly: boolean
  layout: 'one' | 'two'
  teacherNameFormat:
    | 'default'
    | 'first_last'
    | 'first_last_initial'
    | 'first_initial_last'
    | 'first'
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

const formatSlotTime = (value: string) => {
  const [rawHour, rawMinute] = value.split(':')
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return minute === 0 ? `${displayHour}` : `${displayHour}:${String(minute).padStart(2, '0')}`
}

const formatSlotRange = (start: string | null, end: string | null) => {
  if (!start || !end) return ''
  const [startHour] = start.split(':')
  const [endHour] = end.split(':')
  const startHourNum = Number(startHour)
  const endHourNum = Number(endHour)
  if (!Number.isFinite(startHourNum) || !Number.isFinite(endHourNum)) {
    return `${start} - ${end}`
  }
  const startSuffix = startHourNum >= 12 ? 'pm' : 'am'
  const endSuffix = endHourNum >= 12 ? 'pm' : 'am'
  return `${formatSlotTime(start)} ${startSuffix}<br>${formatSlotTime(end)} ${endSuffix}`
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
  switch (format) {
    case 'first_last':
      return last ? `${first} ${last}` : first
    case 'first_last_initial':
      return last ? `${first} ${last.charAt(0)}.` : first
    case 'first_initial_last':
      return last ? `${first.charAt(0)}. ${last}` : first
    case 'first':
      return first
    default:
      return display
  }
}

export function buildDailySchedulePdfHtml({
  dateISO,
  generatedAt,
  data,
  options,
}: {
  dateISO: string
  generatedAt: string
  data: WeeklyScheduleDataByClassroom[]
  options: PdfOptions
}) {
  const timeSlots = buildTimeSlots(data)
  const date = new Date(dateISO + 'T00:00:00')
  const title = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const color = {
    permanent: '#0F172A',
    floater: options.colorFriendly ? '#7E22CE' : '#334155',
    sub: options.colorFriendly ? '#0F766E' : '#334155',
    absent: '#94A3B8',
    grid: '#E2E8F0',
    header: '#0F172A',
  }
  const timeColWidth = 60
  const fontSize = 11

  const buildTableHeaders = (classrooms: WeeklyScheduleDataByClassroom[]) =>
    classrooms
      .map(classroom => {
        const split = splitClassroomName(classroom.classroom_name)
        const textColor =
          options.colorFriendly && classroom.classroom_color ? classroom.classroom_color : '#334155'
        return `
          <th style="border:1px solid ${color.grid}; border-bottom:2px solid #94A3B8; padding:6px; text-align:center; font-size:10px; font-weight:600; color:${textColor}; text-transform: uppercase; letter-spacing: 0.4px;">
            <div style="line-height:1.2;">
              <div>${escapeHtml(split.line1)}</div>
              ${split.line2 ? `<div>${escapeHtml(split.line2)}</div>` : ''}
            </div>
          </th>`
      })
      .join('')

  const buildRows = (classrooms: WeeklyScheduleDataByClassroom[]) =>
    timeSlots
      .map(slot => {
        const timeCell = `
        <td style="border:1px solid ${color.grid}; padding:6px; vertical-align:middle; font-size:12px; font-weight:600; color:#475569;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="font-size:12px; color:${color.header};">${escapeHtml(slot.code)}</div>
            <div style="font-size:11px; color:#94A3B8; line-height:1.2;">
              ${formatSlotRange(slot.start_time, slot.end_time)}
            </div>
          </div>
        </td>`

        const cells = classrooms
          .map(classroom => {
            const slotData = getSlotForClassroom(classroom, slot.id)
            const assignments = slotData?.assignments ?? []
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
              .filter(a => !a.is_substitute && !a.is_floater && !absentTeacherIds.has(a.teacher_id))
              .sort(sortByName)
            const floaters = assignments
              .filter(a => !a.is_substitute && a.is_floater && !absentTeacherIds.has(a.teacher_id))
              .sort(sortByName)
            const sortedAbsences = [...absences].sort(sortByName)

            const teacherLines = regularTeachers
              .map(
                t =>
                  `<div style="color:${color.permanent}; font-weight:500;">${escapeHtml(
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
            const floaterLines = floaters
              .map(
                f =>
                  `<div style="color:${color.floater}; font-weight:500;">◇ ${escapeHtml(
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
            const absenceLines = options.showAbsencesAndSubs
              ? sortedAbsences
                  .map(absence => {
                    const subsForAbsence = substitutesByAbsentTeacher.get(absence.teacher_id) || []
                    const subLines = subsForAbsence
                      .map(
                        sub =>
                          `<div style="margin-left:12px; color:${color.sub}; font-weight:500;">↳ → ${escapeHtml(
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
                    const noSub =
                      !absence.has_sub && subsForAbsence.length === 0
                        ? `<span style="color:${color.absent};"> (no sub)</span>`
                        : ''
                    return `
                    <div style="color:${color.absent}; font-weight:500;">
                      × ${escapeHtml(
                        formatTeacherName(
                          {
                            teacher_name: absence.teacher_name,
                            teacher_first_name: absence.teacher_first_name,
                            teacher_last_name: absence.teacher_last_name,
                            teacher_display_name: absence.teacher_display_name,
                          },
                          options.teacherNameFormat
                        )
                      )}${noSub}
                    </div>
                    ${subLines}`
                  })
                  .join('')
              : ''

            return `
            <td style="border:1px solid ${color.grid}; padding:6px; font-size:${fontSize}px; vertical-align:top;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                ${teacherLines}
                ${floaterLines}
                ${absenceLines}
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
          <th style="border:1px solid ${color.grid}; padding:6px; text-align:left; font-size:12px; font-weight:600; color:#334155;">Time</th>
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
          body { font-family: Arial, sans-serif; color: #0F172A; margin: 0; }
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
                <div style="font-size:16px; font-weight:600; margin-bottom:4px;">${escapeHtml(
                  title
                )}</div>
                <div style="font-size:10px; font-style:italic; color:#64748B; margin-bottom:16px;">
                  Generated by Scheduler · ${escapeHtml(
                    generatedAt
                  )} · Changes after this time may not be reflected.
                </div>
                <div class="legend" style="margin-bottom:14px;">
                  <div style="color:${color.permanent};">Permanent</div>
                  <div style="color:${color.floater};">◇ Floater</div>
                  <div style="color:${color.sub};">→ Sub</div>
                  <div style="color:${color.absent};">× Absent</div>
                </div>
                ${renderTable(classrooms)}
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
