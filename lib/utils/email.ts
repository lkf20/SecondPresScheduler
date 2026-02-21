export function normalizeEmailForStorage(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  // Simple, practical validation for app-level email checks.
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  if (!isValid) return null

  return trimmed
}
