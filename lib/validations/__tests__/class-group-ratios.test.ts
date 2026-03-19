import {
  RatioValidationError,
  hasAtMostOneDecimalPlace,
  validateOptionalRatio,
  validateRequiredRatio,
} from '@/lib/validations/class-group-ratios'

describe('class group ratio validation', () => {
  it('accepts required ratio with one decimal place', () => {
    expect(validateRequiredRatio(3.3)).toBe(3.3)
    expect(validateRequiredRatio('8')).toBe(8)
  })

  it('rejects required ratio with more than one decimal place', () => {
    expect(() => validateRequiredRatio(3.33)).toThrow(RatioValidationError)
    expect(() => validateRequiredRatio('3.33')).toThrow('at most one decimal place')
  })

  it('supports optional preferred ratio as null/undefined', () => {
    expect(validateOptionalRatio(undefined, { allowNull: true })).toBeUndefined()
    expect(validateOptionalRatio(null, { allowNull: true })).toBeNull()
  })

  it('rejects optional preferred ratio below minimum', () => {
    expect(() => validateOptionalRatio(0.9, { allowNull: true })).toThrow('at least 1')
  })

  it('validates one-decimal helper correctly', () => {
    expect(hasAtMostOneDecimalPlace(3.3)).toBe(true)
    expect(hasAtMostOneDecimalPlace(3.33)).toBe(false)
  })
})
