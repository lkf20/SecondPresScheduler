import {
  formatActivityDescriptionText,
  formatDateRangeLabel,
  type ActivityRow,
} from '@/components/activity/activity-description'

const baseRow: ActivityRow = {
  id: 'log-1',
  created_at: '2026-03-18T12:00:00.000Z',
  action: 'create',
  category: 'unknown',
  entity_type: 'record',
  entity_id: null,
  details: {},
  actor_user_id: 'user-1',
  actor_display_name: 'Director',
}

describe('activity-description formatter', () => {
  it('formats school closure create message for a single date', () => {
    const text = formatActivityDescriptionText({
      ...baseRow,
      category: 'school_calendar',
      entity_type: 'school_closure',
      action: 'create',
      details: { date: '2026-04-26', whole_day: true },
    })

    expect(text).toBe('Created school closure for April 26')
  })

  it('formats school closure create message for a date range', () => {
    const text = formatActivityDescriptionText({
      ...baseRow,
      category: 'school_calendar',
      entity_type: 'school_closure',
      action: 'create',
      details: {
        start_date: '2026-04-22',
        end_date: '2026-04-26',
        whole_day: true,
      },
    })

    expect(text).toBe('Created school closure for April 22-26')
  })

  it('formats school closure update and delete with past-tense verbs', () => {
    const updatedText = formatActivityDescriptionText({
      ...baseRow,
      category: 'school_calendar',
      entity_type: 'school_closure',
      action: 'update',
      details: { date: '2026-04-26', reason: 'Snow day', whole_day: true },
    })
    const deletedText = formatActivityDescriptionText({
      ...baseRow,
      category: 'school_calendar',
      entity_type: 'school_closure',
      action: 'delete',
      details: { date: '2026-04-26', whole_day: true },
    })

    expect(updatedText).toBe('Updated school closure for April 26: Snow day')
    expect(deletedText).toBe('Deleted school closure for April 26')
  })

  it('formats sub-assignment unassign without mislabeling as assigned', () => {
    const text = formatActivityDescriptionText({
      ...baseRow,
      category: 'sub_assignment',
      action: 'unassign',
      details: {
        sub_name: 'Victoria I.',
        teacher_name: 'Anne M.',
        removed_count: 1,
      },
    })

    expect(text).toBe('Unassigned Victoria I. from Anne M. (1 shift)')
  })

  it('formats coverage override with detail', () => {
    const text = formatActivityDescriptionText({
      ...baseRow,
      category: 'coverage',
      action: 'assign',
      details: {
        sub_name: 'Victoria I.',
        teacher_name: 'Anne M.',
        reason: 'Director override for unavailable shift',
      },
    })

    expect(text).toBe('Assigned coverage override for Victoria I. to cover Anne M.')
  })

  it('formats fallback with capitalized past-tense verb and humanized entity label', () => {
    const text = formatActivityDescriptionText({
      ...baseRow,
      category: 'new_category',
      action: 'status_change',
      entity_type: 'school_closure',
      details: {},
    })

    expect(text).toBe('Updated school closure')
  })

  it('formats same-month ranges as Month day-day', () => {
    expect(formatDateRangeLabel('2026-04-22', '2026-04-26')).toBe('April 22-26')
  })
})
