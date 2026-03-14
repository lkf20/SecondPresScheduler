/**
 * In-memory cache for /api/dashboard/data-health to avoid a full DB scan on every
 * dashboard mount. Call clearDataHealthCache() after mutations that affect
 * orphaned shifts or related data (e.g. calendar closures, assign-sub, coverage).
 *
 * Cross-tab: clearDataHealthCache() sets a localStorage key so other tabs see
 * invalidation on their next getDataHealthCache() (e.g. when dashboard is focused).
 */

const DATA_HEALTH_CACHE_MS = 60_000
const INVALIDATED_KEY = 'dataHealthCacheInvalidatedAt'

let cache: {
  data: { orphanedShifts?: unknown[] }
  until: number
} | null = null

function clearInMemoryCacheIfInvalidated(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(INVALIDATED_KEY) !== null) {
    cache = null
    localStorage.removeItem(INVALIDATED_KEY)
  }
}

export function getDataHealthCache(): typeof cache {
  clearInMemoryCacheIfInvalidated()
  if (!cache || cache.until <= Date.now()) return null
  return cache
}

export function setDataHealthCache(data: { orphanedShifts?: unknown[] }): void {
  cache = { data, until: Date.now() + DATA_HEALTH_CACHE_MS }
}

/** Call after calendar/closure, assign-sub, or coverage mutations so dashboard refetches. */
export function clearDataHealthCache(): void {
  cache = null
  if (typeof window !== 'undefined') {
    localStorage.setItem(INVALIDATED_KEY, String(Date.now()))
  }
}
