import { getErrorMessage, logError, createErrorResponse } from '../errors'

// Mock console.error
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()

describe('Error Utilities', () => {
  beforeEach(() => {
    mockConsoleError.mockClear()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
  })

  describe('getErrorMessage', () => {
    it('should return error message for Error instances', () => {
      const error = new Error('Test error')
      expect(getErrorMessage(error)).toBe('Test error')
    })

    it('should handle duplicate key errors', () => {
      const error = new Error('duplicate key')
      expect(getErrorMessage(error)).toBe('This record already exists')
    })

    it('should handle foreign key errors', () => {
      const error = new Error('foreign key violation')
      expect(getErrorMessage(error)).toBe('Invalid reference to related data')
    })

    it('should handle PostgreSQL error codes', () => {
      const error = { code: '23505', message: 'Duplicate' } as any
      expect(getErrorMessage(error)).toBe('This record already exists (duplicate key violation)')
    })

    it('should return default message for unknown errors', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred')
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
      expect(getErrorMessage('string error')).toBe('An unexpected error occurred')
    })
  })

  describe('logError', () => {
    it('should log error with context', () => {
      const error = new Error('Test error')
      logError('TestContext', error, { additional: 'info' })

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[TestContext] Error:',
        expect.objectContaining({
          message: 'Test error',
          additional: 'info',
        })
      )
    })

    it('should handle non-Error objects', () => {
      logError('TestContext', 'string error')

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[TestContext] Error:',
        expect.objectContaining({
          message: 'string error',
        })
      )
    })
  })

  describe('createErrorResponse', () => {
    // Mock Response for Node.js environment
    global.Response = class {
      status: number
      body: any

      constructor(body: any, init?: { status?: number }) {
        this.body = body
        this.status = init?.status || 200
      }

      static json(body: any, init?: { status?: number }) {
        return new Response(body, init)
      }
    } as any

    it('should create error response with correct structure', () => {
      const error = new Error('Test error')
      const response = createErrorResponse(error, 'User message', 500, 'TestContext')

      expect(response.status).toBe(500)
      expect(mockConsoleError).toHaveBeenCalled()
    })

    it('should include details in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const error = new Error('Test error')
      const response = createErrorResponse(error, 'User message', 500, 'TestContext')

      expect(response.status).toBe(500)
      expect(mockConsoleError).toHaveBeenCalled()

      process.env.NODE_ENV = originalEnv
    })
  })
})

