import { render, waitFor } from '@testing-library/react'
import SubPreferencesSection from '@/components/subs/SubPreferencesSection'

jest.mock('@/components/subs/SubClassPreferences', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/subs/SubQualifications', () => ({
  __esModule: true,
  default: () => null,
}))

const originalFetch = global.fetch

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return { promise, resolve }
}

describe('SubPreferencesSection dirty state', () => {
  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('does not mark dirty when qualifications resolve before preferences on initial load', async () => {
    const preferences = deferred<Response>()
    const qualifications = deferred<Response>()
    const onDirtyChange = jest.fn()

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/preferences')) {
        return preferences.promise
      }
      if (url.includes('/qualifications')) {
        return qualifications.promise
      }
      throw new Error(`Unexpected fetch call: ${url}`)
    }) as jest.Mock

    render(
      <SubPreferencesSection
        subId="sub-race-test"
        sub={{
          can_change_diapers: false,
          can_lift_children: false,
          can_assist_with_toileting: false,
        }}
        onDirtyChange={onDirtyChange}
      />
    )

    qualifications.resolve({
      ok: true,
      json: async () => [],
    } as Response)

    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenCalled()
    })

    preferences.resolve({
      ok: true,
      json: async () => [{ id: 'pref-1', class_group_id: 'cg-1' }],
    } as Response)

    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenCalledWith(false)
    })

    const everDirty = onDirtyChange.mock.calls.some(call => call[0] === true)
    expect(everDirty).toBe(false)
  })
})
