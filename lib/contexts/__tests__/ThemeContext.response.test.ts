/** @jest-environment jsdom */

import { readThemeFromResponse } from '@/lib/contexts/ThemeContext'

const createResponseMock = ({
  contentType,
  jsonImpl,
}: {
  contentType: string
  jsonImpl: () => Promise<unknown>
}) =>
  ({
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    json: jsonImpl,
  }) as unknown as Response

describe('readThemeFromResponse', () => {
  it('returns theme when response has valid JSON payload', async () => {
    const response = createResponseMock({
      contentType: 'application/json',
      jsonImpl: async () => ({ theme: 'system' }),
    })

    await expect(readThemeFromResponse(response)).resolves.toBe('system')
  })

  it('returns null when content-type is not JSON', async () => {
    const response = createResponseMock({
      contentType: 'text/html; charset=utf-8',
      jsonImpl: async () => ({ theme: 'system' }),
    })

    await expect(readThemeFromResponse(response)).resolves.toBeNull()
  })

  it('returns null when JSON payload is malformed', async () => {
    const response = createResponseMock({
      contentType: 'application/json',
      jsonImpl: async () => {
        throw new TypeError('The string did not match the expected pattern.')
      },
    })

    await expect(readThemeFromResponse(response)).resolves.toBeNull()
  })

  it('returns null when theme is not an allowed value', async () => {
    const response = createResponseMock({
      contentType: 'application/json',
      jsonImpl: async () => ({ theme: 'blue' }),
    })

    await expect(readThemeFromResponse(response)).resolves.toBeNull()
  })
})
