/** @jest-environment node */

import { GET, PATCH } from '@/app/api/settings/calendar/route'
import {
  getCalendarSettings,
  updateCalendarSettings,
  getSchoolClosuresForDateRange,
  getSchoolClosuresByIds,
  createSchoolClosure,
  createSchoolClosureRange,
  updateSchoolClosure,
  deleteSchoolClosure,
} from '@/lib/api/school-calendar'
import { getUserSchoolId } from '@/lib/utils/auth'

jest.mock('@/lib/api/school-calendar', () => ({
  getCalendarSettings: jest.fn(),
  updateCalendarSettings: jest.fn(),
  getSchoolClosuresForDateRange: jest.fn(),
  getSchoolClosuresByIds: jest.fn(),
  createSchoolClosure: jest.fn(),
  createSchoolClosureRange: jest.fn(),
  updateSchoolClosure: jest.fn(),
  deleteSchoolClosure: jest.fn(),
}))

jest.mock('@/lib/utils/auth', () => ({
  getUserSchoolId: jest.fn(),
}))

jest.mock('@/lib/audit/logAuditEvent', () => ({
  getAuditActorContext: jest.fn().mockResolvedValue({ actorUserId: null, actorDisplayName: null }),
  logAuditEvent: jest.fn().mockResolvedValue(true),
}))

describe('calendar settings route integration', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(getUserSchoolId as jest.Mock).mockResolvedValue('school-1')
    ;(getCalendarSettings as jest.Mock).mockResolvedValue({
      first_day_of_school: '2024-08-15',
      last_day_of_school: '2025-05-30',
    })
    ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('GET', () => {
    it('returns 403 when school context is missing', async () => {
      ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost/api/settings/calendar')
      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(403)
      expect(json.error).toMatch(/missing school_id/i)
    })

    it('returns calendar settings and closures for date range', async () => {
      ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([
        { id: 'c-1', date: '2024-12-25', time_slot_id: null, reason: 'Holiday' },
      ])

      const request = new Request(
        'http://localhost/api/settings/calendar?startDate=2024-01-01&endDate=2025-12-31'
      )
      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.first_day_of_school).toBe('2024-08-15')
      expect(json.last_day_of_school).toBe('2025-05-30')
      expect(json.school_closures).toHaveLength(1)
      expect(getSchoolClosuresForDateRange).toHaveBeenCalledWith(
        'school-1',
        expect.any(String),
        expect.any(String)
      )
    })

    it('returns empty closures when no date range provided', async () => {
      ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])

      const request = new Request('http://localhost/api/settings/calendar')
      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.school_closures).toEqual([])
    })
  })

  describe('PATCH', () => {
    it('returns 403 when school context is missing', async () => {
      ;(getUserSchoolId as jest.Mock).mockResolvedValue(null)

      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ first_day_of_school: '2024-08-15' }),
        })
      )
      const json = await response.json()

      expect(response.status).toBe(403)
      expect(json.error).toMatch(/missing school_id/i)
    })

    it('updates school year dates', async () => {
      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_day_of_school: '2024-08-20',
            last_day_of_school: '2025-06-05',
          }),
        })
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(updateCalendarSettings).toHaveBeenCalledWith('school-1', {
        first_day_of_school: '2024-08-20',
        last_day_of_school: '2025-06-05',
      })
      expect(json.first_day_of_school).toBe('2024-08-15')
      expect(json.last_day_of_school).toBe('2025-05-30')
    })

    it('deletes closures by ids', async () => {
      ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
      ;(getSchoolClosuresByIds as jest.Mock).mockResolvedValue([
        { id: 'c-1', date: '2024-12-25', time_slot_id: null, reason: 'Holiday' },
        { id: 'c-2', date: '2024-12-26', time_slot_id: null, reason: 'Holiday' },
      ])

      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delete_closure_ids: ['c-1', 'c-2'] }),
        })
      )

      expect(response.status).toBe(200)
      expect(deleteSchoolClosure).toHaveBeenCalledWith('school-1', 'c-1')
      expect(deleteSchoolClosure).toHaveBeenCalledWith('school-1', 'c-2')
    })

    it('adds single-day closure', async () => {
      ;(createSchoolClosure as jest.Mock).mockResolvedValue({
        id: 'c-new',
        date: '2024-12-25',
        time_slot_id: null,
        reason: 'Holiday',
      })

      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              date: '2024-12-25',
              time_slot_id: null,
              reason: 'Holiday',
            },
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(createSchoolClosure).toHaveBeenCalledWith('school-1', {
        date: '2024-12-25',
        time_slot_id: null,
        reason: 'Holiday',
        notes: null,
      })
    })

    it('adds date range closure', async () => {
      ;(createSchoolClosureRange as jest.Mock).mockResolvedValue({ created: 3, skipped: 0 })

      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              start_date: '2024-12-24',
              end_date: '2024-12-26',
              reason: 'Holiday break',
            },
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(createSchoolClosureRange).toHaveBeenCalledWith(
        'school-1',
        '2024-12-24',
        '2024-12-26',
        'Holiday break',
        null
      )
    })

    it('returns 400 when add_closure.date is missing for single-day', async () => {
      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: { time_slot_id: null, reason: 'Test' },
          }),
        })
      )
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toMatch(/date is required/i)
    })

    it('returns 400 when add_closure start_date > end_date', async () => {
      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              start_date: '2024-12-26',
              end_date: '2024-12-24',
              reason: 'Test',
            },
          }),
        })
      )
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toMatch(/on or before end_date/i)
    })

    it('returns 409 when add_closure would duplicate (school_id, date, time_slot_id)', async () => {
      const duplicateMessage = 'A closure already exists for this date and time slot.'
      ;(createSchoolClosure as jest.Mock).mockRejectedValue(new Error(duplicateMessage))
      ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])

      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closure: {
              date: '2024-12-25',
              time_slot_id: 'slot-1',
              reason: 'Holiday',
            },
          }),
        })
      )
      const json = await response.json()

      expect(response.status).toBe(409)
      expect(json.error).toBe(duplicateMessage)
    })

    it('edits closure in place via update_closures (preserves row id)', async () => {
      ;(getSchoolClosuresByIds as jest.Mock).mockResolvedValue([
        {
          id: 'c-1',
          date: '2024-12-25',
          time_slot_id: null,
          reason: 'Holiday',
          notes: null,
        },
      ])
      ;(updateSchoolClosure as jest.Mock).mockResolvedValue({
        id: 'c-1',
        date: '2024-12-25',
        time_slot_id: null,
        reason: 'Winter break',
        notes: 'Office closed',
      })
      ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])

      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            update_closures: [{ id: 'c-1', reason: 'Winter break', notes: 'Office closed' }],
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(updateSchoolClosure).toHaveBeenCalledWith('school-1', 'c-1', {
        reason: 'Winter break',
        notes: 'Office closed',
      })
      expect(deleteSchoolClosure).not.toHaveBeenCalled()
      expect(createSchoolClosure).not.toHaveBeenCalled()
    })

    it('edits closure by deleting then adding when shape changes (e.g. slots changed)', async () => {
      ;(getSchoolClosuresByIds as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: 'c-1',
            date: '2024-12-25',
            time_slot_id: null,
            reason: 'Holiday',
            notes: null,
          },
        ])
        .mockResolvedValue([])
      ;(deleteSchoolClosure as jest.Mock).mockResolvedValue(undefined)
      ;(createSchoolClosure as jest.Mock).mockResolvedValue({
        id: 'c-new',
        date: '2024-12-25',
        time_slot_id: 'slot-1',
        reason: 'Winter break',
        notes: null,
      })
      ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])

      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delete_closure_ids: ['c-1'],
            add_closures: [
              {
                date: '2024-12-25',
                time_slot_id: 'slot-1',
                reason: 'Winter break',
                notes: null,
              },
            ],
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(deleteSchoolClosure).toHaveBeenCalledWith('school-1', 'c-1')
      expect(createSchoolClosure).toHaveBeenCalledWith('school-1', {
        date: '2024-12-25',
        time_slot_id: 'slot-1',
        reason: 'Winter break',
        notes: null,
      })
    })

    it('rolls back created closures when a later add_closures item fails (e.g. duplicate)', async () => {
      ;(getSchoolClosuresForDateRange as jest.Mock).mockResolvedValue([])
      ;(createSchoolClosure as jest.Mock)
        .mockResolvedValueOnce({
          id: 'c-first',
          date: '2024-12-25',
          time_slot_id: 'slot-1',
          reason: 'Test',
          notes: null,
        })
        .mockRejectedValueOnce(Object.assign(new Error('already exists'), { code: '23505' }))
      ;(deleteSchoolClosure as jest.Mock).mockResolvedValue(undefined)

      const response = await PATCH(
        new Request('http://localhost/api/settings/calendar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_closures: [
              { date: '2024-12-25', time_slot_id: 'slot-1', reason: 'Test', notes: null },
              { date: '2024-12-25', time_slot_id: 'slot-2', reason: 'Test', notes: null },
            ],
          }),
        })
      )

      expect(response.status).toBe(409)
      expect(createSchoolClosure).toHaveBeenCalledTimes(2)
      expect(deleteSchoolClosure).toHaveBeenCalledTimes(1)
      expect(deleteSchoolClosure).toHaveBeenCalledWith('school-1', 'c-first')
    })
  })
})
