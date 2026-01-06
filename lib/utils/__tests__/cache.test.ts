import { cache, cachedFetch, invalidateCache } from '../cache'

// Mock fetch
global.fetch = jest.fn()

describe('SimpleCache', () => {
  beforeEach(() => {
    cache.clear()
    jest.clearAllMocks()
  })

  describe('get and set', () => {
    it('should store and retrieve data', () => {
      cache.set('test-key', 'test-value', 1000)
      expect(cache.get('test-key')).toBe('test-value')
    })

    it('should return null for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeNull()
    })

    it('should return null for expired entries', () => {
      cache.set('test-key', 'test-value', 100) // 100ms TTL
      expect(cache.get('test-key')).toBe('test-value')

      // Wait for expiration
      jest.useFakeTimers()
      jest.advanceTimersByTime(150)
      expect(cache.get('test-key')).toBeNull()
      jest.useRealTimers()
    })

    it('should use default TTL of 5 minutes', () => {
      const now = Date.now()
      jest.spyOn(Date, 'now').mockReturnValue(now)

      cache.set('test-key', 'test-value')
      const entry = (cache as any).cache.get('test-key')

      expect(entry.ttl).toBe(5 * 60 * 1000) // 5 minutes
      jest.spyOn(Date, 'now').mockRestore()
    })
  })

  describe('delete', () => {
    it('should delete a specific cache entry', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.delete('key1')

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBe('value2')
    })
  })

  describe('clear', () => {
    it('should clear all cache entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.clear()

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })
  })

  describe('clearExpired', () => {
    it('should remove expired entries', () => {
      jest.useFakeTimers()
      const now = Date.now()

      cache.set('expired', 'value', 100)
      cache.set('valid', 'value', 10000)

      jest.advanceTimersByTime(150)
      cache.clearExpired()

      expect(cache.get('expired')).toBeNull()
      expect(cache.get('valid')).toBe('value')

      jest.useRealTimers()
    })
  })
})

describe('cachedFetch', () => {
  beforeEach(() => {
    cache.clear()
    jest.clearAllMocks()
  })

  it('should return cached data if available', async () => {
    const cachedData = { id: 1, name: 'Cached' }
    cache.set('http://example.com/api', cachedData, 5000)

    const result = await cachedFetch('http://example.com/api')

    expect(result).toEqual(cachedData)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should fetch and cache data if not cached', async () => {
    const mockData = { id: 1, name: 'Fetched' }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    })

    const result = await cachedFetch('http://example.com/api')

    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledWith('http://example.com/api', undefined)
    expect(cache.get('http://example.com/api')).toEqual(mockData)
  })

  it('should throw error if fetch fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    })

    await expect(cachedFetch('http://example.com/api')).rejects.toThrow(
      'Failed to fetch http://example.com/api: Not Found'
    )
  })

  it('should use custom TTL', async () => {
    const mockData = { id: 1 }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    })

    await cachedFetch('http://example.com/api', undefined, 10000)

    const entry = (cache as any).cache.get('http://example.com/api')
    expect(entry.ttl).toBe(10000)
  })
})

describe('invalidateCache', () => {
  beforeEach(() => {
    cache.clear()
  })

  it('should delete cache entry by exact string match', () => {
    cache.set('api/users', { data: 'users' })
    cache.set('api/posts', { data: 'posts' })

    invalidateCache('api/users')

    expect(cache.get('api/users')).toBeNull()
    expect(cache.get('api/posts')).toEqual({ data: 'posts' })
  })

  it('should delete cache entries matching regex pattern', () => {
    cache.set('api/users/1', { data: 'user1' })
    cache.set('api/users/2', { data: 'user2' })
    cache.set('api/posts/1', { data: 'post1' })

    invalidateCache(/api\/users\/\d+/)

    expect(cache.get('api/users/1')).toBeNull()
    expect(cache.get('api/users/2')).toBeNull()
    expect(cache.get('api/posts/1')).toEqual({ data: 'post1' })
  })
})

