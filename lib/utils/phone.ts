export function getPhoneDigits(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function normalizeUSPhoneForStorage(value: string | null | undefined): string | null {
  const digits = getPhoneDigits(value)
  if (!digits) return null

  // Accept +1XXXXXXXXXX and store as 10 digits.
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1)
  }

  if (digits.length === 10) {
    return digits
  }

  return null
}

export function isValidUSPhone(value: string | null | undefined): boolean {
  return normalizeUSPhoneForStorage(value) !== null
}

export function formatUSPhone(value: string | null | undefined): string {
  const normalized = normalizeUSPhoneForStorage(value)
  if (!normalized) return value ?? ''
  const area = normalized.slice(0, 3)
  const prefix = normalized.slice(3, 6)
  const line = normalized.slice(6)
  return `(${area}) ${prefix}-${line}`
}

export function formatUSPhoneDashed(value: string | null | undefined): string {
  const normalized = normalizeUSPhoneForStorage(value)
  if (!normalized) return value ?? ''
  const area = normalized.slice(0, 3)
  const prefix = normalized.slice(3, 6)
  const line = normalized.slice(6)
  return `${area}-${prefix}-${line}`
}

export function formatUSPhoneDashedInput(value: string | null | undefined): string {
  const digits = getPhoneDigits(value).slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}
