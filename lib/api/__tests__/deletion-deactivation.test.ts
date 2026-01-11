/**
 * Tests for handling deletion and deactivation of entities
 * 
 * This test suite covers:
 * - Class groups (soft delete via is_active)
 * - Classrooms (soft delete via is_active)
 * - Teachers (hard delete)
 * - Subs (hard delete)
 * - Error handling for entities with dependencies
 */

import { 
  deleteClassGroup, 
  updateClassGroup, 
  getClassGroupById 
} from '../class-groups'
import { 
  deleteClassroom, 
  updateClassroom, 
  getClassroomById 
} from '../classrooms'
import { 
  deleteTeacher, 
  updateTeacher, 
  getTeacherById 
} from '../teachers'
import { 
  deleteSub, 
  updateSub, 
  getSubById 
} from '../subs'
import { createClient } from '@/lib/supabase/server'

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('Deletion and Deactivation Handling', () => {
  let mockSupabase: {
    from: jest.Mock
    select: jest.Mock
    insert: jest.Mock
    update: jest.Mock
    delete: jest.Mock
    eq: jest.Mock
    single: jest.Mock
    order: jest.Mock
  }

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Class Groups', () => {
    describe('Soft Delete (is_active = false)', () => {
      it('should set is_active to false when deleting', async () => {
        const classGroupId = 'test-class-group-id'
        const mockClassGroup = {
          id: classGroupId,
          name: 'Test Class',
          is_active: false,
        }

        mockSupabase.single.mockResolvedValue({
          data: mockClassGroup,
          error: null,
        })

        const result = await deleteClassGroup(classGroupId)

        expect(mockSupabase.from).toHaveBeenCalledWith('class_groups')
        expect(mockSupabase.update).toHaveBeenCalledWith({ is_active: false })
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', classGroupId)
        expect(result.is_active).toBe(false)
      })

      it('should handle errors when deleting class group', async () => {
        const classGroupId = 'test-class-group-id'
        const mockError = { message: 'Database error', code: 'PGRST116' }

        mockSupabase.single.mockResolvedValue({
          data: null,
          error: mockError,
        })

        await expect(deleteClassGroup(classGroupId)).rejects.toEqual(mockError)
      })

      it('should allow deactivation via updateClassGroup', async () => {
        const classGroupId = 'test-class-group-id'
        const mockClassGroup = {
          id: classGroupId,
          name: 'Test Class',
          is_active: false,
        }

        mockSupabase.single.mockResolvedValue({
          data: mockClassGroup,
          error: null,
        })

        const result = await updateClassGroup(classGroupId, { is_active: false })

        expect(mockSupabase.from).toHaveBeenCalledWith('class_groups')
        expect(mockSupabase.update).toHaveBeenCalledWith({ is_active: false })
        expect(result.is_active).toBe(false)
      })

      it('should still be retrievable after soft delete', async () => {
        const classGroupId = 'test-class-group-id'
        const mockClassGroup = {
          id: classGroupId,
          name: 'Test Class',
          is_active: false,
        }

        // Mock delete
        mockSupabase.single.mockResolvedValueOnce({
          data: mockClassGroup,
          error: null,
        })
        await deleteClassGroup(classGroupId)

        // Mock get by id (should still work)
        mockSupabase.single.mockResolvedValueOnce({
          data: mockClassGroup,
          error: null,
        })
        const result = await getClassGroupById(classGroupId)

        expect(result).toEqual(mockClassGroup)
        expect(result.is_active).toBe(false)
      })
    })
  })

  describe('Classrooms', () => {
    describe('Soft Delete (is_active = false)', () => {
      it('should set is_active to false when deleting', async () => {
        const classroomId = 'test-classroom-id'
        const mockClassroom = {
          id: classroomId,
          name: 'Test Classroom',
          is_active: false,
        }

        mockSupabase.single.mockResolvedValue({
          data: mockClassroom,
          error: null,
        })

        const result = await deleteClassroom(classroomId)

        expect(mockSupabase.from).toHaveBeenCalledWith('classrooms')
        expect(mockSupabase.update).toHaveBeenCalledWith({ is_active: false })
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', classroomId)
        expect(result.is_active).toBe(false)
      })

      it('should handle errors when deleting classroom', async () => {
        const classroomId = 'test-classroom-id'
        const mockError = { message: 'Database error', code: 'PGRST116' }

        mockSupabase.single.mockResolvedValue({
          data: null,
          error: mockError,
        })

        await expect(deleteClassroom(classroomId)).rejects.toEqual(mockError)
      })

      it('should allow deactivation via updateClassroom', async () => {
        const classroomId = 'test-classroom-id'
        const mockClassroom = {
          id: classroomId,
          name: 'Test Classroom',
          is_active: false,
        }

        mockSupabase.single.mockResolvedValue({
          data: mockClassroom,
          error: null,
        })

        const result = await updateClassroom(classroomId, { is_active: false })

        expect(mockSupabase.from).toHaveBeenCalledWith('classrooms')
        expect(mockSupabase.update).toHaveBeenCalledWith({ is_active: false })
        expect(result.is_active).toBe(false)
      })
    })
  })

  describe('Teachers', () => {
    describe('Hard Delete', () => {
      it('should delete teacher from database', async () => {
        const teacherId = 'test-teacher-id'

        mockSupabase.eq.mockResolvedValue({
          error: null,
        })

        await deleteTeacher(teacherId)

        expect(mockSupabase.from).toHaveBeenCalledWith('staff')
        expect(mockSupabase.delete).toHaveBeenCalled()
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', teacherId)
      })

      it('should handle foreign key constraint errors when teacher has schedules', async () => {
        const teacherId = 'test-teacher-id'
        const mockError = {
          message: 'foreign key constraint violation',
          code: '23503',
          details: 'Key (id) is still referenced from table "teacher_schedules"',
        }

        mockSupabase.eq.mockResolvedValue({
          error: mockError,
        })

        await expect(deleteTeacher(teacherId)).rejects.toEqual(mockError)
      })

      it('should handle errors when deleting teacher', async () => {
        const teacherId = 'test-teacher-id'
        const mockError = { message: 'Database error', code: 'PGRST116' }

        mockSupabase.eq.mockResolvedValue({
          error: mockError,
        })

        await expect(deleteTeacher(teacherId)).rejects.toEqual(mockError)
      })
    })

    describe('Deactivation (active = false)', () => {
      it('should set active to false when deactivating', async () => {
        const teacherId = 'test-teacher-id'
        const mockTeacher = {
          id: teacherId,
          first_name: 'Test',
          last_name: 'Teacher',
          active: false,
        }

        mockSupabase.single.mockResolvedValue({
          data: mockTeacher,
          error: null,
        })

        const result = await updateTeacher(teacherId, { active: false })

        expect(mockSupabase.from).toHaveBeenCalledWith('staff')
        expect(mockSupabase.update).toHaveBeenCalledWith({ active: false })
        expect(result.active).toBe(false)
      })

      it('should allow reactivation by setting active to true', async () => {
        const teacherId = 'test-teacher-id'
        const mockTeacher = {
          id: teacherId,
          first_name: 'Test',
          last_name: 'Teacher',
          active: true,
        }

        mockSupabase.single.mockResolvedValue({
          data: mockTeacher,
          error: null,
        })

        const result = await updateTeacher(teacherId, { active: true })

        expect(result.active).toBe(true)
      })
    })
  })

  describe('Subs', () => {
    describe('Hard Delete', () => {
      it('should delete sub from database', async () => {
        const subId = 'test-sub-id'

        mockSupabase.eq.mockResolvedValue({
          error: null,
        })

        await deleteSub(subId)

        expect(mockSupabase.from).toHaveBeenCalledWith('staff')
        expect(mockSupabase.delete).toHaveBeenCalled()
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', subId)
      })

      it('should handle foreign key constraint errors when sub has availability', async () => {
        const subId = 'test-sub-id'
        const mockError = {
          message: 'foreign key constraint violation',
          code: '23503',
          details: 'Key (id) is still referenced from table "sub_availability"',
        }

        mockSupabase.eq.mockResolvedValue({
          error: mockError,
        })

        await expect(deleteSub(subId)).rejects.toEqual(mockError)
      })

      it('should handle errors when deleting sub', async () => {
        const subId = 'test-sub-id'
        const mockError = { message: 'Database error', code: 'PGRST116' }

        mockSupabase.eq.mockResolvedValue({
          error: mockError,
        })

        await expect(deleteSub(subId)).rejects.toEqual(mockError)
      })
    })

    describe('Deactivation (active = false)', () => {
      it('should set active to false when deactivating', async () => {
        const subId = 'test-sub-id'
        const mockSub = {
          id: subId,
          first_name: 'Test',
          last_name: 'Sub',
          active: false,
        }

        mockSupabase.single.mockResolvedValue({
          data: mockSub,
          error: null,
        })

        const result = await updateSub(subId, { active: false })

        expect(mockSupabase.from).toHaveBeenCalledWith('staff')
        expect(mockSupabase.update).toHaveBeenCalledWith({ active: false })
        expect(result.active).toBe(false)
      })

      it('should allow reactivation by setting active to true', async () => {
        const subId = 'test-sub-id'
        const mockSub = {
          id: subId,
          first_name: 'Test',
          last_name: 'Sub',
          active: true,
        }

        mockSupabase.single.mockResolvedValue({
          data: mockSub,
          error: null,
        })

        const result = await updateSub(subId, { active: true })

        expect(result.active).toBe(true)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-existent class group deletion gracefully', async () => {
      const classGroupId = 'non-existent-id'
      const mockError = {
        message: 'No rows found',
        code: 'PGRST116',
      }

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: mockError,
      })

      await expect(deleteClassGroup(classGroupId)).rejects.toEqual(mockError)
    })

    it('should handle non-existent classroom deletion gracefully', async () => {
      const classroomId = 'non-existent-id'
      const mockError = {
        message: 'No rows found',
        code: 'PGRST116',
      }

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: mockError,
      })

      await expect(deleteClassroom(classroomId)).rejects.toEqual(mockError)
    })

    it('should handle non-existent teacher deletion gracefully', async () => {
      const teacherId = 'non-existent-id'
      const mockError = {
        message: 'No rows found',
        code: 'PGRST116',
      }

      mockSupabase.eq.mockResolvedValue({
        error: mockError,
      })

      await expect(deleteTeacher(teacherId)).rejects.toEqual(mockError)
    })

    it('should handle non-existent sub deletion gracefully', async () => {
      const subId = 'non-existent-id'
      const mockError = {
        message: 'No rows found',
        code: 'PGRST116',
      }

      mockSupabase.eq.mockResolvedValue({
        error: mockError,
      })

      await expect(deleteSub(subId)).rejects.toEqual(mockError)
    })

    it('should handle network errors during deletion', async () => {
      const classGroupId = 'test-id'
      const mockError = {
        message: 'Network error',
        code: 'ECONNREFUSED',
      }

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: mockError,
      })

      await expect(deleteClassGroup(classGroupId)).rejects.toEqual(mockError)
    })
  })
})
