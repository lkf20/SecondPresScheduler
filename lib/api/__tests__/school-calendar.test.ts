/** @jest-environment node */

import {
  getCalendarSettings,
  getSchoolClosuresForDateRange,
  createSchoolClosure,
  createSchoolClosureRange,
  deleteSchoolClosure,
} from '../school-calendar'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('school-calendar', () => {
  let orderChain: { order: jest.Mock }
  let mockSupabase: {
    from: jest.Mock
    select: jest.Mock
    insert: jest.Mock
    delete: jest.Mock
    eq: jest.Mock
    gte: jest.Mock
    lte: jest.Mock
    order: jest.Mock
    limit: jest.Mock
    maybeSingle: jest.Mock
    single: jest.Mock
  }

  beforeEach(() => {
    orderChain = { order: jest.fn() }
    const chain = {} as typeof mockSupabase
    mockSupabase = {
      from: jest.fn().mockReturnValue(chain),
      select: jest.fn().mockReturnValue(chain),
      insert: jest.fn().mockReturnValue(chain),
      delete: jest.fn().mockReturnValue(chain),
      eq: jest.fn().mockReturnValue(chain),
      gte: jest.fn().mockReturnValue(chain),
      lte: jest.fn().mockReturnValue(chain),
      order: jest.fn().mockReturnValue(orderChain),
      limit: jest.fn().mockReturnValue(chain),
      maybeSingle: jest.fn(),
      single: jest.fn(),
    }
    Object.assign(chain, mockSupabase)
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  describe('getCalendarSettings', () => {
    it('returns settings when found', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          first_day_of_school: '2024-08-15',
          last_day_of_school: '2025-05-30',
        },
        error: null,
      })

      const result = await getCalendarSettings('school-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('schedule_settings')
      expect(mockSupabase.select).toHaveBeenCalledWith('first_day_of_school, last_day_of_school')
      expect(mockSupabase.eq).toHaveBeenCalledWith('school_id', 'school-1')
      expect(mockSupabase.limit).toHaveBeenCalledWith(1)
      expect(result).toEqual({
        first_day_of_school: '2024-08-15',
        last_day_of_school: '2025-05-30',
      })
    })

    it('returns nulls when table does not exist', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      })

      const result = await getCalendarSettings('school-1')

      expect(result).toEqual({
        first_day_of_school: null,
        last_day_of_school: null,
      })
    })
  })

  describe('getSchoolClosuresForDateRange', () => {
    it('returns closures for date range', async () => {
      orderChain.order.mockResolvedValue({
        data: [
          {
            id: 'c-1',
            school_id: 'school-1',
            date: '2024-12-25',
            time_slot_id: null,
            reason: 'Holiday',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      })

      const result = await getSchoolClosuresForDateRange('school-1', '2024-12-01', '2024-12-31')

      expect(mockSupabase.from).toHaveBeenCalledWith('school_closures')
      expect(mockSupabase.select).toHaveBeenCalledWith(
        'id, school_id, date, time_slot_id, reason, notes, created_at'
      )
      expect(mockSupabase.eq).toHaveBeenCalledWith('school_id', 'school-1')
      expect(mockSupabase.gte).toHaveBeenCalledWith('date', '2024-12-01')
      expect(mockSupabase.lte).toHaveBeenCalledWith('date', '2024-12-31')
      expect(result).toHaveLength(1)
      expect(result[0].date).toBe('2024-12-25')
      expect(result[0].reason).toBe('Holiday')
    })

    it('returns empty array when table does not exist', async () => {
      orderChain.order.mockResolvedValue({
        data: null,
        error: { code: '42P01' },
      })

      const result = await getSchoolClosuresForDateRange('school-1', '2024-12-01', '2024-12-31')

      expect(result).toEqual([])
    })
  })

  describe('createSchoolClosure', () => {
    it('creates a closure and returns it', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'c-new',
          school_id: 'school-1',
          date: '2024-12-25',
          time_slot_id: null,
          reason: 'Holiday',
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      })

      const result = await createSchoolClosure('school-1', {
        date: '2024-12-25',
        time_slot_id: null,
        reason: 'Holiday',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('school_closures')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        school_id: 'school-1',
        date: '2024-12-25',
        time_slot_id: null,
        reason: 'Holiday',
        notes: null,
      })
      expect(result.id).toBe('c-new')
      expect(result.date).toBe('2024-12-25')
    })

    it('throws user-friendly error when duplicate key (23505)', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "idx_school_closures_slot_unique"',
        },
      })

      await expect(
        createSchoolClosure('school-1', {
          date: '2024-12-25',
          time_slot_id: 'slot-1',
          reason: 'Holiday',
        })
      ).rejects.toThrow('A closure already exists for this date and time slot.')
    })
  })

  describe('createSchoolClosureRange', () => {
    it('throws when range exceeds 365 days', async () => {
      await expect(
        createSchoolClosureRange('school-1', '2024-01-01', '2025-12-31', null)
      ).rejects.toThrow('Date range cannot exceed 365 days')
    })

    it('creates closures for each day in range', async () => {
      orderChain.order.mockResolvedValue({ data: [], error: null })
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'c-1',
            school_id: 'school-1',
            date: '2024-12-24',
            time_slot_id: null,
            reason: null,
            created_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'c-2',
            school_id: 'school-1',
            date: '2024-12-25',
            time_slot_id: null,
            reason: null,
            created_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'c-3',
            school_id: 'school-1',
            date: '2024-12-26',
            time_slot_id: null,
            reason: null,
            created_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        })

      const result = await createSchoolClosureRange(
        'school-1',
        '2024-12-24',
        '2024-12-26',
        'Holiday'
      )

      expect(result).toEqual({ created: 3, skipped: 0 })
    })
  })

  describe('deleteSchoolClosure', () => {
    it('calls delete with correct filters', async () => {
      mockSupabase.eq.mockReturnValueOnce(mockSupabase).mockResolvedValueOnce({ error: null })

      await deleteSchoolClosure('school-1', 'c-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('school_closures')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'c-1')
      expect(mockSupabase.eq).toHaveBeenCalledWith('school_id', 'school-1')
    })
  })
})
