import { filterCoverageRequestsToActiveTimeOffOnly } from '../filter-draft-time-off'

describe('filterCoverageRequestsToActiveTimeOffOnly', () => {
  it('keeps non-time_off coverage requests regardless of active set', () => {
    const requests = [
      { id: 'cr1', request_type: 'manual', source_request_id: null },
      { id: 'cr2', request_type: 'extra_coverage', source_request_id: null },
    ]
    const active = new Set<string>()
    expect(filterCoverageRequestsToActiveTimeOffOnly(requests, active)).toEqual(requests)
  })

  it('excludes time_off coverage request when source is draft (not in active set)', () => {
    const requests = [
      {
        id: 'cr1',
        request_type: 'time_off',
        source_request_id: 'tor-draft',
        teacher_id: 't1',
      },
    ]
    const active = new Set<string>()
    expect(filterCoverageRequestsToActiveTimeOffOnly(requests, active)).toEqual([])
  })

  it('keeps time_off coverage request when source is active (in active set)', () => {
    const requests = [
      {
        id: 'cr1',
        request_type: 'time_off',
        source_request_id: 'tor-active',
        teacher_id: 't1',
      },
    ]
    const active = new Set<string>(['tor-active'])
    expect(filterCoverageRequestsToActiveTimeOffOnly(requests, active)).toEqual(requests)
  })

  it('returns only active time off when mix of draft and active', () => {
    const requests = [
      {
        id: 'cr1',
        request_type: 'time_off',
        source_request_id: 'tor-draft',
        teacher_id: 't1',
      },
      {
        id: 'cr2',
        request_type: 'time_off',
        source_request_id: 'tor-active',
        teacher_id: 't2',
      },
    ]
    const active = new Set<string>(['tor-active'])
    const result = filterCoverageRequestsToActiveTimeOffOnly(requests, active)
    expect(result).toHaveLength(1)
    expect(result[0].source_request_id).toBe('tor-active')
  })

  it('excludes time_off with null source_request_id when not in active set', () => {
    const requests = [
      {
        id: 'cr1',
        request_type: 'time_off',
        source_request_id: null,
        teacher_id: 't1',
      },
    ]
    const active = new Set<string>()
    const result = filterCoverageRequestsToActiveTimeOffOnly(requests, active)
    expect(result).toHaveLength(0)
  })
})
