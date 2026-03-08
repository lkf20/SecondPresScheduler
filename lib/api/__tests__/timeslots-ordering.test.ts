import { createTimeSlot, updateTimeSlot, sortTimeSlotsForDisplayOrder } from '@/lib/api/timeslots'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

type MockTimeSlot = {
  id: string
  code: string
  default_start_time: string | null
  default_end_time: string | null
  display_order: number | null
  school_id: string
  is_active?: boolean
  name?: string | null
}

function buildMockSupabase(initialRows: MockTimeSlot[]) {
  const state = {
    rows: [...initialRows],
    currentMode: 'idle' as 'idle' | 'select' | 'update',
    currentUpdatePayload: {} as Record<string, unknown>,
    updateFilterId: '' as string,
    updateFilterSchoolId: '' as string,
  }

  const table = {
    insert: jest.fn((payload: Record<string, unknown>) => ({
      select: () => ({
        single: async () => {
          const created: MockTimeSlot = {
            id: 'slot-new',
            code: String(payload.code),
            default_start_time: (payload.default_start_time as string | null) ?? null,
            default_end_time: (payload.default_end_time as string | null) ?? null,
            display_order: (payload.display_order as number | null) ?? null,
            school_id: String(payload.school_id),
            is_active: (payload.is_active as boolean | undefined) ?? true,
            name: (payload.name as string | null) ?? null,
          }
          state.rows.push(created)
          return { data: created, error: null }
        },
      }),
    })),
    select: jest.fn(() => {
      if (state.currentMode !== 'update') {
        state.currentMode = 'select'
      }
      return table
    }),
    update: jest.fn((payload: Record<string, unknown>) => {
      state.currentMode = 'update'
      state.currentUpdatePayload = payload
      state.updateFilterId = ''
      state.updateFilterSchoolId = ''
      return table
    }),
    eq: jest.fn((field: string, value: string) => {
      if (state.currentMode === 'select') {
        if (field === 'school_id') {
          return Promise.resolve({
            data: state.rows.filter(row => row.school_id === value),
            error: null,
          })
        }
        return table
      }

      if (state.currentMode === 'update') {
        const updateKeys = Object.keys(state.currentUpdatePayload)
        const isDisplayOrderResequenceOnly =
          updateKeys.length === 1 && updateKeys[0] === 'display_order'

        if (field === 'id') {
          state.updateFilterId = value
        }
        if (field === 'school_id') {
          state.updateFilterSchoolId = value
        }

        if (isDisplayOrderResequenceOnly && state.updateFilterId) {
          state.rows = state.rows.map(row =>
            row.id === state.updateFilterId
              ? { ...row, display_order: Number(state.currentUpdatePayload.display_order) }
              : row
          )
          state.currentMode = 'idle'
          return Promise.resolve({ error: null })
        }
      }

      return table
    }),
    single: jest.fn(async () => {
      const id = state.updateFilterId
      const schoolId = state.updateFilterSchoolId
      const idx = state.rows.findIndex(row => row.id === id && row.school_id === schoolId)
      if (idx === -1) {
        return { data: null, error: { message: 'not found' } }
      }
      const next = { ...state.rows[idx], ...state.currentUpdatePayload }
      state.rows[idx] = next
      state.currentMode = 'idle'
      return { data: next, error: null }
    }),
  }

  const supabase = {
    from: jest.fn((tableName: string) => {
      if (tableName !== 'time_slots') throw new Error(`Unexpected table ${tableName}`)
      return table
    }),
  }

  return { supabase, state }
}

describe('time slot ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
  })

  it('sortTimeSlotsForDisplayOrder sorts by start time then code', () => {
    const sorted = (
      [
        {
          id: '2',
          code: 'AM',
          default_start_time: '08:00:00',
          display_order: 2,
        },
        {
          id: '1',
          code: 'EM',
          default_start_time: '06:00:00',
          display_order: 3,
        },
        {
          id: '3',
          code: 'LB',
          default_start_time: '08:00:00',
          display_order: 1,
        },
      ] as any
    )
      .sort(sortTimeSlotsForDisplayOrder)
      .map((slot: MockTimeSlot) => slot.code)

    expect(sorted).toEqual(['EM', 'LB', 'AM'])
  })

  it('resequences display_order after creating a time slot', async () => {
    const { supabase, state } = buildMockSupabase([
      {
        id: 'slot-em',
        code: 'EM',
        default_start_time: '07:00:00',
        default_end_time: '08:00:00',
        display_order: 1,
        school_id: 'school-1',
      },
      {
        id: 'slot-pm',
        code: 'PM',
        default_start_time: '13:00:00',
        default_end_time: '14:00:00',
        display_order: 2,
        school_id: 'school-1',
      },
    ])
    ;(createClient as jest.Mock).mockResolvedValue(supabase)

    await createTimeSlot({
      code: 'AM',
      default_start_time: '08:00:00',
      default_end_time: '09:00:00',
    })

    const byCode = new Map(state.rows.map(slot => [slot.code, slot.display_order]))
    expect(byCode.get('EM')).toBe(1)
    expect(byCode.get('AM')).toBe(2)
    expect(byCode.get('PM')).toBe(3)
  })

  it('resequences display_order after updating a time slot start time', async () => {
    const { supabase, state } = buildMockSupabase([
      {
        id: 'slot-em',
        code: 'EM',
        default_start_time: '07:00:00',
        default_end_time: '08:00:00',
        display_order: 1,
        school_id: 'school-1',
      },
      {
        id: 'slot-am',
        code: 'AM',
        default_start_time: '08:00:00',
        default_end_time: '09:00:00',
        display_order: 2,
        school_id: 'school-1',
      },
    ])
    ;(createClient as jest.Mock).mockResolvedValue(supabase)

    await updateTimeSlot('slot-am', {
      default_start_time: '06:00:00',
      default_end_time: '07:00:00',
    })

    const byCode = new Map(state.rows.map(slot => [slot.code, slot.display_order]))
    expect(byCode.get('AM')).toBe(1)
    expect(byCode.get('EM')).toBe(2)
  })
})
