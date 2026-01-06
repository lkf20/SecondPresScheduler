/**
 * Simple in-memory cache utility for client-side data fetching
 * For production, consider using React Query or SWR for more advanced caching
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) {
      return null
    }
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Entry has expired
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  /**
   * Set cached data with a time-to-live
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Clear a specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Export a singleton instance
export const cache = new SimpleCache()

/**
 * Cached fetch utility
 * Fetches data and caches it for the specified TTL
 */
export async function cachedFetch<T>(
  url: string,
  options?: RequestInit,
  ttl: number = 5 * 60 * 1000 // 5 minutes default
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(url)
  if (cached !== null) {
    return cached
  }

  // Fetch and cache
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
  }
  
  const data = await response.json() as T
  cache.set(url, data, ttl)
  return data
}

/**
 * Invalidate cache for a specific URL pattern
 */
export function invalidateCache(pattern: string | RegExp): void {
  if (typeof pattern === 'string') {
    cache.delete(pattern)
  } else {
    // Clear all entries matching the regex pattern
    for (const key of cache['cache'].keys()) {
      if (pattern.test(key)) {
        cache.delete(key)
      }
    }
  }
}


