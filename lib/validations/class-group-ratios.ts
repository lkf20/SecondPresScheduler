export class RatioValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RatioValidationError'
  }
}

const RATIO_MAX = 999.9
const DECIMAL_EPSILON = 1e-9

export const hasAtMostOneDecimalPlace = (value: number): boolean => {
  return Math.abs(value * 10 - Math.round(value * 10)) < DECIMAL_EPSILON
}

const coerceNumber = (value: unknown): number | null | undefined => {
  if (value === undefined || value === '') return undefined
  if (value === null) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const validateParsedRatio = (value: number, fieldLabel: string): number => {
  if (value < 1) {
    throw new RatioValidationError(`${fieldLabel} must be at least 1`)
  }
  if (value > RATIO_MAX) {
    throw new RatioValidationError(`${fieldLabel} must be ${RATIO_MAX} or less`)
  }
  if (!hasAtMostOneDecimalPlace(value)) {
    throw new RatioValidationError(`${fieldLabel} can have at most one decimal place`)
  }
  return value
}

export const validateRequiredRatio = (value: unknown, fieldLabel = 'Required ratio'): number => {
  const parsed = coerceNumber(value)
  if (parsed === undefined || parsed === null) {
    throw new RatioValidationError(`${fieldLabel} is required`)
  }
  return validateParsedRatio(parsed, fieldLabel)
}

export const validateOptionalRatio = (
  value: unknown,
  {
    fieldLabel = 'Preferred ratio',
    allowNull = false,
  }: { fieldLabel?: string; allowNull?: boolean } = {}
): number | null | undefined => {
  const parsed = coerceNumber(value)
  if (parsed === undefined) return undefined
  if (parsed === null) {
    if (allowNull) return null
    throw new RatioValidationError(`${fieldLabel} cannot be null`)
  }
  return validateParsedRatio(parsed, fieldLabel)
}
