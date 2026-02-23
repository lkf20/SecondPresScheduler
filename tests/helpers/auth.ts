import * as auth from '@/lib/utils/auth'

export const mockUserSchoolId = (schoolId: string | null) =>
  jest.spyOn(auth, 'getUserSchoolId').mockResolvedValue(schoolId)
