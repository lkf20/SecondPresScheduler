import {
  buildSubAvailabilityPdfHtml,
  buildSubAvailabilityReportModel,
  sanitizeRichTextHtml,
} from '@/lib/reports/sub-availability-pdf'

describe('sub availability pdf report helpers', () => {
  it('orders columns by day display order then time slot display order', () => {
    const model = buildSubAvailabilityReportModel({
      subs: [
        {
          id: 'sub-1',
          first_name: 'Anne',
          last_name: 'M',
          display_name: null,
          phone: null,
        },
      ],
      days: [
        { id: 'day-wed', name: 'Wed', display_order: 3 },
        { id: 'day-mon', name: 'Mon', display_order: 1 },
      ],
      timeSlots: [
        { id: 'slot-pm', code: 'PM', name: null, display_order: 2 },
        { id: 'slot-am', code: 'AM', name: null, display_order: 1 },
      ],
      availabilityRows: [],
      classGroups: [],
      preferences: [],
    })

    expect(model.columns.map(column => `${column.dayName}-${column.timeSlotCode}`)).toEqual([
      'Mon-AM',
      'Mon-PM',
      'Wed-AM',
      'Wed-PM',
    ])
  })

  it('defaults missing availability records to unavailable', () => {
    const model = buildSubAvailabilityReportModel({
      subs: [
        {
          id: 'sub-1',
          first_name: 'Anne',
          last_name: 'M',
          display_name: null,
          phone: null,
        },
      ],
      days: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
      timeSlots: [{ id: 'slot-am', code: 'AM', name: null, display_order: 1 }],
      availabilityRows: [],
      classGroups: [],
      preferences: [],
    })

    expect(model.rows[0]?.matrix[0]?.available).toBe(false)
  })

  it('derives Available to teach from selected class groups', () => {
    const model = buildSubAvailabilityReportModel({
      subs: [
        {
          id: 'sub-1',
          first_name: 'Anne',
          last_name: 'M',
          display_name: null,
          phone: null,
        },
      ],
      days: [],
      timeSlots: [],
      availabilityRows: [],
      classGroups: [
        { id: 'cg-1', name: 'Infants', order: 1, min_age: 0 },
        { id: 'cg-2', name: 'Toddler A', order: 2, min_age: 1 },
        { id: 'cg-3', name: 'Toddler B', order: 3, min_age: 1 },
      ],
      preferences: [{ sub_id: 'sub-1', class_group_id: 'cg-1', can_teach: true }],
    })

    expect(model.rows[0]?.canTeach).toEqual(['Infants'])
  })

  it('renders availability table with updated teachability header', () => {
    const model = buildSubAvailabilityReportModel({
      subs: [
        {
          id: 'sub-1',
          first_name: 'Anne',
          last_name: 'M',
          display_name: null,
          phone: null,
        },
      ],
      days: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
      timeSlots: [{ id: 'slot-am', code: 'AM', name: null, display_order: 1 }],
      availabilityRows: [
        { sub_id: 'sub-1', day_of_week_id: 'day-mon', time_slot_id: 'slot-am', available: true },
      ],
      classGroups: [
        { id: 'cg-1', name: 'Infants', order: 1, min_age: 0 },
        { id: 'cg-2', name: 'Toddlers', order: 2, min_age: 1 },
        { id: 'cg-3', name: 'Twos', order: 3, min_age: 2 },
        { id: 'cg-4', name: 'Preschool', order: 4, min_age: 3 },
        { id: 'cg-5', name: 'Pre-K', order: 5, min_age: 4 },
      ],
      preferences: [],
    })

    const html = buildSubAvailabilityPdfHtml({
      generatedAt: 'Jan 25, 2026, 8:00 AM',
      reportContext: model,
    })

    expect(html).toContain('availability-mark')
    expect(html).toContain('availability-mark-icon')
    expect(html).toContain('<svg class="availability-mark-icon"')
    expect(html).toContain('Available to teach')
    expect(html).not.toContain('>Notes<')
  })

  it('shows All except when unteachable groups are fewer than teachable groups', () => {
    const model = buildSubAvailabilityReportModel({
      subs: [
        {
          id: 'sub-1',
          first_name: 'Anne',
          last_name: 'M',
          display_name: null,
          phone: null,
        },
      ],
      days: [],
      timeSlots: [],
      availabilityRows: [],
      classGroups: [
        { id: 'cg-1', name: 'Infants', order: 1, min_age: 0 },
        { id: 'cg-2', name: 'Toddler A', order: 2, min_age: 1 },
        { id: 'cg-3', name: 'Toddler B', order: 3, min_age: 1 },
        { id: 'cg-4', name: "3's", order: 4, min_age: 3 },
      ],
      preferences: [
        { sub_id: 'sub-1', class_group_id: 'cg-1', can_teach: true },
        { sub_id: 'sub-1', class_group_id: 'cg-2', can_teach: true },
        { sub_id: 'sub-1', class_group_id: 'cg-3', can_teach: true },
      ],
    })

    expect(model.rows[0]?.canTeach).toEqual(["All except 3's"])
  })

  it('renders rich text top header inline with report header and preserves font tag styling', () => {
    const model = buildSubAvailabilityReportModel({
      subs: [],
      days: [{ id: 'day-mon', name: 'Mon', display_order: 1 }],
      timeSlots: [{ id: 'slot-am', code: 'AM', name: null, display_order: 1 }],
      availabilityRows: [],
      classGroups: [],
      preferences: [],
    })

    const html = buildSubAvailabilityPdfHtml({
      generatedAt: 'Jan 25, 2026, 8:00 AM',
      reportContext: model,
      topHeaderHtml: '<div><font size="5" color="#1d4ed8">CENTER TITLE</font></div>',
    })

    expect(html).toContain('class="header-center"')
    expect(html).toContain('CENTER TITLE')
    expect(html).toContain('font-size: 18px')
    expect(html).toContain('color: #1d4ed8')
  })

  it('applies rich-text footer styling safely', () => {
    const model = buildSubAvailabilityReportModel({
      subs: [],
      days: [],
      timeSlots: [],
      availabilityRows: [],
      classGroups: [],
      preferences: [],
    })

    const html = buildSubAvailabilityPdfHtml({
      generatedAt: 'Jan 25, 2026, 8:00 AM',
      reportContext: model,
      footerNotesHtml:
        '<div style="text-align:center"><font size="4"><mark>Important note</mark></font></div>',
    })

    expect(html).toContain('class="footer-note"')
    expect(html).toContain('Important note')
    expect(html).toContain('text-align: center')
    expect(html).toContain('font-size: 16px')
    expect(html).not.toContain('<script')
  })

  it('sanitizes rich text by removing scripts and unsafe attributes while preserving allowed style', () => {
    const html = sanitizeRichTextHtml(
      `<div onclick="alert(1)" style="text-align:center;position:absolute">` +
        `<font size="4" color="#1d4ed8"><mark>Safe</mark></font>` +
        `<script>alert("xss")</script></div>`
    )

    expect(html).toContain('<div style="text-align: center">')
    expect(html).toContain('<span style="font-size: 16px; color: #1d4ed8">')
    expect(html).toContain('<mark>Safe</mark>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<script')
  })

  it('blocks unsafe css injection through font color attributes', () => {
    const html = sanitizeRichTextHtml(
      '<div><font color="red;background:url(//evil.com)">Unsafe</font></div>'
    )

    expect(html).toContain('<div><span>Unsafe</span></div>')
    expect(html).not.toContain('background:url')
    expect(html).not.toContain('url(')
  })
})
