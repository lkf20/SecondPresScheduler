import { z } from 'zod'
import { validateRequest, validateQueryParams } from '../validation'

// Mock NextResponse at module level
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      body,
      status: (init && init.status) || 200,
    })),
  },
}))

const testSchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().min(0), // Use coerce for query params
  email: z.string().email().optional(),
})

describe('validateRequest', () => {
  it('should return success with valid data', () => {
    const data = { name: 'John', age: 30, email: 'john@example.com' }
    const result = validateRequest(testSchema, data)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(data)
    }
  })

  it('should return error with invalid data', () => {
    const data = { name: '', age: -5 }
    const result = validateRequest(testSchema, data)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.status).toBe(400)
    }
  })

  it('should handle missing required fields', () => {
    const data = { age: 30 }
    const result = validateRequest(testSchema, data)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.status).toBe(400)
    }
  })

  it('should handle optional fields', () => {
    const data = { name: 'John', age: 30 }
    const result = validateRequest(testSchema, data)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeUndefined()
    }
  })

  it('should return validation error details', () => {
    const data = { name: '', age: 'not-a-number' }
    const result = validateRequest(testSchema, data)

    expect(result.success).toBe(false)
    if (!result.success) {
      // Error should contain details about what failed
      expect(result.error.status).toBe(400)
    }
  })
})

describe('validateQueryParams', () => {
  it('should validate query parameters successfully', () => {
    const searchParams = new URLSearchParams()
    searchParams.set('name', 'John')
    searchParams.set('age', '30')

    const result = validateQueryParams(testSchema, searchParams)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('John')
      // Zod will coerce string to number if schema expects number
      expect(result.data.age).toBe(30)
    }
  })

  it('should handle string numbers in query params', () => {
    // Create a schema that accepts string and coerces to number
    const querySchema = z.object({
      name: z.string().min(1),
      age: z.coerce.number().int().min(0),
    })

    const searchParams = new URLSearchParams()
    searchParams.set('name', 'John')
    searchParams.set('age', '25')

    const result = validateQueryParams(querySchema, searchParams)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(typeof result.data.age).toBe('number')
      expect(result.data.age).toBe(25)
    }
  })

  it('should handle missing required parameters', () => {
    const searchParams = new URLSearchParams()
    searchParams.set('age', '30')

    const result = validateQueryParams(testSchema, searchParams)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.status).toBe(400)
    }
  })

  it('should handle empty query params', () => {
    const searchParams = new URLSearchParams()

    const result = validateQueryParams(testSchema, searchParams)

    expect(result.success).toBe(false)
  })
})
