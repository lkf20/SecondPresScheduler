/**
 * Tests for the audit log validator.
 * Contract: docs/contracts/AUDIT_LOG_CONTRACT.md
 * Ensures gold examples pass, bad examples fail, and generic logs cannot slip through.
 */

import { validateAuditLogEntry } from '../validateAuditLog'
import type { AuditLogEntryInput } from '../validateAuditLog'

describe('validateAuditLogEntry', () => {
  describe('gold examples (must pass)', () => {
    it('passes baseline assign teacher with full names', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        actorDisplayName: 'Jane Admin',
        action: 'assign',
        category: 'baseline_schedule',
        entityType: 'teacher_schedule',
        entityId: 'schedule-uuid',
        details: {
          teacher_id: 'staff-uuid',
          teacher_name: 'Maria Garcia',
          classroom_id: 'classroom-uuid',
          classroom_name: 'Toddler A',
          day_of_week_id: 'day-uuid',
          day_name: 'Monday',
          time_slot_id: 'slot-uuid',
          time_slot_code: 'AM',
          is_floater: false,
        },
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('passes time off create with teacher name', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        actorDisplayName: 'Jane Admin',
        action: 'create',
        category: 'time_off',
        entityType: 'time_off_request',
        entityId: 'request-uuid',
        details: {
          teacher_id: 'staff-uuid',
          teacher_name: 'John Smith',
          status: 'approved',
          start_date: '2025-03-01',
          end_date: '2025-03-05',
          shifts_created: 4,
          shifts_excluded: 0,
        },
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('passes baseline bulk update with summary', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        actorDisplayName: 'Jane Admin',
        action: 'update',
        category: 'baseline_schedule',
        entityType: 'schedule_cell',
        entityId: 'first-cell-uuid',
        details: {
          cell_count: 3,
          bulk: true,
          classroom_name: 'Toddler A',
          day_name: 'Monday',
          time_slot_codes: 'AM, PM',
          summary: '3 cells in Toddler A, Monday (AM, PM)',
        },
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('bad examples (must fail)', () => {
    it('fails generic update with only IDs and no human-readable names', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        actorDisplayName: 'Jane Admin',
        action: 'update',
        category: 'baseline_schedule',
        entityType: 'teacher_schedule',
        entityId: 'schedule-uuid',
        details: {
          teacher_id: 'staff-uuid',
          classroom_id: 'classroom-uuid',
          day_of_week_id: 'day-uuid',
          time_slot_id: 'slot-uuid',
        },
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('human-readable'))).toBe(true)
      expect(
        result.errors.some(e => e.includes('updated_fields') || e.includes('before/after'))
      ).toBe(true)
    })

    it('fails assign with empty details', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        action: 'assign',
        category: 'baseline_schedule',
        entityType: 'teacher_schedule',
        entityId: 'schedule-uuid',
        details: {},
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('non-empty') || e.includes('details'))).toBe(true)
    })
  })

  describe('generic log cannot slip through', () => {
    it('fails update with only IDs and no updated_fields or before/after', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        actorDisplayName: 'Jane Admin',
        action: 'update',
        category: 'baseline_schedule',
        entityType: 'schedule_cell',
        entityId: 'cell-uuid',
        details: {
          classroom_id: 'c1',
          day_of_week_id: 'd1',
          time_slot_id: 's1',
        },
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('fails create with null details', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        action: 'create',
        category: 'baseline_schedule',
        entityType: 'schedule_cell',
        entityId: 'cell-uuid',
        details: null,
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('non-empty') || e.includes('details'))).toBe(true)
    })

    it('fails when school_id is missing', () => {
      const entry: AuditLogEntryInput = {
        schoolId: '',
        actorUserId: 'user-uuid',
        action: 'assign',
        category: 'baseline_schedule',
        entityType: 'teacher_schedule',
        entityId: 'schedule-uuid',
        details: {
          teacher_id: 'staff-uuid',
          teacher_name: 'Maria Garcia',
          classroom_id: 'c1',
          classroom_name: 'Toddler A',
          day_name: 'Monday',
          time_slot_code: 'AM',
        },
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('school_id'))).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('passes update with updated_fields and human-readable names', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        actorDisplayName: 'Jane Admin',
        action: 'update',
        category: 'baseline_schedule',
        entityType: 'teacher_schedule',
        entityId: 'schedule-uuid',
        details: {
          teacher_id: 'staff-uuid',
          teacher_name: 'Maria Garcia',
          classroom_id: 'c1',
          classroom_name: 'Toddler A',
          day_name: 'Monday',
          time_slot_code: 'AM',
          updated_fields: ['is_floater'],
        },
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(true)
    })

    it('passes schedule_cell delete with human-readable names', () => {
      const entry: AuditLogEntryInput = {
        schoolId: 'school-uuid',
        actorUserId: 'user-uuid',
        actorDisplayName: 'Jane Admin',
        action: 'delete',
        category: 'baseline_schedule',
        entityType: 'schedule_cell',
        entityId: 'cell-uuid',
        details: {
          classroom_id: 'c1',
          classroom_name: 'Toddler A',
          day_of_week_id: 'd1',
          day_name: 'Monday',
          time_slot_id: 's1',
          time_slot_code: 'AM',
          is_active: false,
        },
      }
      const result = validateAuditLogEntry(entry)
      expect(result.valid).toBe(true)
    })
  })
})
