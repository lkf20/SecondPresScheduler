/**
 * In-memory cache for /api/dashboard/data-health to avoid a full DB scan on every
 * dashboard mount. Call clearDataHealthCache() after mutations that affect
 * orphaned shifts or related data (e.g. calendar closures, assign-sub, coverage).
 */

const DATA_HEALTH_CACHE_MS = 60_000

let cache: {
  data: { orphanedShifts?: unknown[] }
  until: number
} | null = null

export function getDataHealthCache(): typeof cache {
  if (!cache || cache.until <= Date.now()) return null
  return cache
}

export function setDataHealthCache(data: { orphanedShifts?: unknown[] }): void {
  cache = { data, until: Date.now() + DATA_HEALTH_CACHE_MS }
}

/** Call after calendar/closure, assign-sub, or coverage mutations so dashboard refetches. */
export function clearDataHealthCache(): void {
  cache = null
}
