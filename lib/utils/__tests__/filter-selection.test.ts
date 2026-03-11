import {
  includeNewIdsWhenPreviouslyAllSelected,
  reconcileSelectedIdsWithAvailable,
} from '@/lib/utils/filter-selection'

describe('filter selection helpers', () => {
  describe('reconcileSelectedIdsWithAvailable', () => {
    it('removes stale ids while preserving valid selections', () => {
      const selected = ['a', 'stale']
      const available = ['a', 'b', 'c']
      expect(reconcileSelectedIdsWithAvailable(selected, available)).toEqual(['a'])
    })

    it('keeps all selected intent when selected count indicates all', () => {
      const selected = ['a', 'b', 'stale']
      const available = ['a', 'b']
      expect(reconcileSelectedIdsWithAvailable(selected, available)).toEqual(['a', 'b'])
    })
  })

  describe('includeNewIdsWhenPreviouslyAllSelected', () => {
    it('auto-includes newly added ids when all were previously selected', () => {
      const selected = ['ts1', 'ts2']
      const previousAvailable = ['ts1', 'ts2']
      const currentAvailable = ['ts1', 'ts2', 'ts3']
      expect(
        includeNewIdsWhenPreviouslyAllSelected(selected, previousAvailable, currentAvailable)
      ).toEqual(['ts1', 'ts2', 'ts3'])
    })

    it('does not auto-include newly added ids when a subset was selected', () => {
      const selected = ['ts1']
      const previousAvailable = ['ts1', 'ts2']
      const currentAvailable = ['ts1', 'ts2', 'ts3']
      expect(
        includeNewIdsWhenPreviouslyAllSelected(selected, previousAvailable, currentAvailable)
      ).toEqual(['ts1'])
    })
  })
})
