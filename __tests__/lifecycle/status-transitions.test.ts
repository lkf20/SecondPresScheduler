import {
  canTransitionCoverageRequestShiftStatus,
  canTransitionCoverageRequestStatus,
  canTransitionSubAssignmentStatus,
  canTransitionTimeOffStatus,
  formatTransitionError,
} from '@/lib/lifecycle/status-transitions'

describe('status transitions', () => {
  it('allows valid time off transitions', () => {
    expect(canTransitionTimeOffStatus('draft', 'active')).toBe(true)
    expect(canTransitionTimeOffStatus('draft', 'cancelled')).toBe(true)
    expect(canTransitionTimeOffStatus('active', 'cancelled')).toBe(true)
  })

  it('blocks invalid time off transitions', () => {
    expect(canTransitionTimeOffStatus('active', 'draft')).toBe(false)
    expect(canTransitionTimeOffStatus('cancelled', 'active')).toBe(false)
  })

  it('allows valid coverage request transitions', () => {
    expect(canTransitionCoverageRequestStatus('open', 'filled')).toBe(true)
    expect(canTransitionCoverageRequestStatus('open', 'cancelled')).toBe(true)
    expect(canTransitionCoverageRequestStatus('filled', 'cancelled')).toBe(true)
  })

  it('blocks invalid coverage request transitions', () => {
    expect(canTransitionCoverageRequestStatus('filled', 'open')).toBe(false)
    expect(canTransitionCoverageRequestStatus('cancelled', 'open')).toBe(false)
  })

  it('allows valid coverage request shift transitions', () => {
    expect(canTransitionCoverageRequestShiftStatus('active', 'cancelled')).toBe(true)
  })

  it('blocks invalid coverage request shift transitions', () => {
    expect(canTransitionCoverageRequestShiftStatus('cancelled', 'active')).toBe(false)
  })

  it('allows valid sub assignment transitions', () => {
    expect(canTransitionSubAssignmentStatus('active', 'cancelled')).toBe(true)
  })

  it('blocks invalid sub assignment transitions', () => {
    expect(canTransitionSubAssignmentStatus('cancelled', 'active')).toBe(false)
  })

  it('formats transition errors consistently', () => {
    expect(formatTransitionError('draft', 'active')).toBe(
      'Invalid status transition: draft → active'
    )
  })
})
