/** @jest-environment node */

import { PUT } from '@/app/api/weekly-schedule/cell-note/route'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'
import { getAuditActorContext, logAuditEvent } from '@/lib/audit/logAuditEvent'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/audit/logAuditEvent', () => ({
  getAuditActorContext: jest.fn(),
  logAuditEvent: jest.fn(),
}))

function createSupabaseMock({
  existingOverride = null,
  baselineNote = 'Anne M. arrives at 11am',
  upsertedOverride = {
    id: 'override-1',
    override_mode: 'custom' as const,
    note: 'Anne M. arrives at 11:30am.',
  },
}: {
  existingOverride?: { id: string; override_mode: 'custom' | 'hidden'; note: string | null } | null
  baselineNote?: string | null
  upsertedOverride?: { id: string; override_mode: 'custom' | 'hidden'; note: string | null }
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'classrooms') {
        const q = {
          select: jest.fn(() => q),
          eq: jest.fn(() => q),
          maybeSingle: jest.fn(async () => ({ data: { id: 'class-1', name: 'Infant Room' } })),
        }
        return q
      }

      if (table === 'time_slots') {
        const q = {
          select: jest.fn(() => q),
          eq: jest.fn(() => q),
          maybeSingle: jest.fn(async () => ({ data: { id: 'slot-1', code: 'AM' } })),
        }
        return q
      }

      if (table === 'schedule_cells') {
        const q = {
          select: jest.fn(() => q),
          eq: jest.fn(() => q),
          maybeSingle: jest.fn(async () => ({
            data: { id: 'cell-1', notes: baselineNote },
          })),
        }
        return q
      }

      if (table === 'weekly_schedule_cell_notes') {
        let selectedForSingle = false
        const q = {
          select: jest.fn(() => {
            selectedForSingle = true
            return q
          }),
          eq: jest.fn(() => q),
          maybeSingle: jest.fn(async () => ({ data: existingOverride })),
          delete: jest.fn(() => q),
          upsert: jest.fn(() => q),
          single: jest.fn(async () => ({
            data: selectedForSingle ? upsertedOverride : null,
            error: null,
          })),
        }
        return q
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('PUT /api/weekly-schedule/cell-note integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuditActorContext as jest.Mock).mockResolvedValue({
      actorUserId: 'user-1',
      actorDisplayName: 'Director A',
    })
    ;(logAuditEvent as jest.Mock).mockResolvedValue(true)
  })

  it('returns 403 when school context is missing', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

    const response = await PUT(
      new Request('http://localhost/api/weekly-schedule/cell-note', {
        method: 'PUT',
        body: JSON.stringify({}),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/missing school_id/i)
  })

  it('returns 400 for custom override with blank note', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createClient as jest.Mock).mockResolvedValue(createSupabaseMock({}))

    const response = await PUT(
      new Request('http://localhost/api/weekly-schedule/cell-note', {
        method: 'PUT',
        body: JSON.stringify({
          date: '2026-03-05',
          day_of_week_id: '11111111-1111-4111-8111-111111111111',
          classroom_id: '22222222-2222-4222-8222-222222222222',
          time_slot_id: '33333333-3333-4333-8333-333333333333',
          use_baseline_note: false,
          override_mode: 'custom',
          note: '   ',
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/note is required/i)
  })

  it('saves hidden override and returns effective_note=null', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    const supabase = createSupabaseMock({
      upsertedOverride: {
        id: 'override-hidden',
        override_mode: 'hidden',
        note: null,
      },
    })
    ;(createClient as jest.Mock).mockResolvedValue(supabase)

    const response = await PUT(
      new Request('http://localhost/api/weekly-schedule/cell-note', {
        method: 'PUT',
        body: JSON.stringify({
          date: '2026-03-05',
          day_of_week_id: '11111111-1111-4111-8111-111111111111',
          classroom_id: '22222222-2222-4222-8222-222222222222',
          time_slot_id: '33333333-3333-4333-8333-333333333333',
          use_baseline_note: false,
          override_mode: 'hidden',
          note: null,
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.is_note_hidden_for_date).toBe(true)
    expect(json.effective_note).toBeNull()
    expect(logAuditEvent).toHaveBeenCalled()
  })

  it('removes override when use_baseline_note=true', async () => {
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({
        existingOverride: {
          id: 'override-existing',
          override_mode: 'custom',
          note: 'Old custom note',
        },
      })
    )

    const response = await PUT(
      new Request('http://localhost/api/weekly-schedule/cell-note', {
        method: 'PUT',
        body: JSON.stringify({
          date: '2026-03-05',
          day_of_week_id: '11111111-1111-4111-8111-111111111111',
          classroom_id: '22222222-2222-4222-8222-222222222222',
          time_slot_id: '33333333-3333-4333-8333-333333333333',
          use_baseline_note: true,
        }),
      }) as any
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.weekly_note_override).toBeNull()
    expect(json.effective_note).toBe('Anne M. arrives at 11am')
  })
})
