import { buildEditClosurePayload, type EditClosureGroup } from '../build-edit-closure-payload'

describe('buildEditClosurePayload', () => {
  const baseGroup: EditClosureGroup = {
    date: '2024-12-25',
    closures: [{ id: 'c-1', time_slot_id: null }],
    reason: 'Holiday',
    notes: null,
  }

  it('uses update_closures when shape unchanged (whole day -> whole day)', () => {
    const body = buildEditClosurePayload(baseGroup, 'all', [], 'Winter break', 'Office closed')
    expect(body.update_closures).toBeDefined()
    expect(body.update_closures).toHaveLength(1)
    expect(body.update_closures![0]).toEqual({
      id: 'c-1',
      reason: 'Winter break',
      notes: 'Office closed',
    })
    expect(body.delete_closure_ids).toBeUndefined()
    expect(body.add_closures).toBeUndefined()
  })

  it('uses update_closure_shapes + add_closures when shape changes (whole day -> specific slots)', () => {
    const body = buildEditClosurePayload(
      baseGroup,
      'specific',
      ['slot-1', 'slot-2'],
      'Winter break',
      null
    )
    expect(body.update_closures).toBeUndefined()
    expect(body.update_closure_shapes).toHaveLength(1)
    expect(body.update_closure_shapes).toEqual([
      { id: 'c-1', time_slot_id: 'slot-1', reason: 'Winter break', notes: null },
    ])
    expect(body.delete_closure_ids).toBeUndefined()
    expect(body.add_closures).toHaveLength(1)
    expect(body.add_closures).toEqual([
      { date: '2024-12-25', time_slot_id: 'slot-2', reason: 'Winter break', notes: null },
    ])
  })

  it('uses update_closure_shapes + delete_closure_ids when shape changes (specific slots -> whole day)', () => {
    const group: EditClosureGroup = {
      date: '2024-12-25',
      closures: [
        { id: 'c-1', time_slot_id: 'slot-1' },
        { id: 'c-2', time_slot_id: 'slot-2' },
      ],
      reason: 'Partial',
      notes: null,
    }
    const body = buildEditClosurePayload(group, 'all', [], 'Whole day', null)
    expect(body.update_closures).toBeUndefined()
    expect(body.update_closure_shapes).toHaveLength(1)
    expect(body.update_closure_shapes).toEqual([
      { id: 'c-1', time_slot_id: null, reason: 'Whole day', notes: null },
    ])
    expect(body.delete_closure_ids).toEqual(['c-2'])
    expect(body.add_closures).toBeUndefined()
  })

  it('uses update_closures when same slots (specific -> same specific)', () => {
    const group: EditClosureGroup = {
      date: '2024-12-25',
      closures: [
        { id: 'c-1', time_slot_id: 'slot-1' },
        { id: 'c-2', time_slot_id: 'slot-2' },
      ],
      reason: 'Partial',
      notes: null,
    }
    const body = buildEditClosurePayload(group, 'specific', ['slot-1', 'slot-2'], 'Updated', null)
    expect(body.update_closures).toBeDefined()
    expect(body.update_closures).toHaveLength(2)
    expect(body.delete_closure_ids).toBeUndefined()
    expect(body.add_closures).toBeUndefined()
  })

  it('uses update_closure_shapes only when slots change (different set, same count)', () => {
    const group: EditClosureGroup = {
      date: '2024-12-25',
      closures: [
        { id: 'c-1', time_slot_id: 'slot-1' },
        { id: 'c-2', time_slot_id: 'slot-2' },
      ],
      reason: 'Partial',
      notes: null,
    }
    const body = buildEditClosurePayload(group, 'specific', ['slot-2', 'slot-3'], 'Updated', null)
    expect(body.update_closures).toBeUndefined()
    expect(body.update_closure_shapes).toHaveLength(2)
    expect(body.update_closure_shapes).toEqual([
      { id: 'c-1', time_slot_id: 'slot-2', reason: 'Updated', notes: null },
      { id: 'c-2', time_slot_id: 'slot-3', reason: 'Updated', notes: null },
    ])
    expect(body.delete_closure_ids).toBeUndefined()
    expect(body.add_closures).toBeUndefined()
  })
})
