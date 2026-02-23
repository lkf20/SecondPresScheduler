type MockApiRequest = {
  method: string
  nextUrl: URL
  headers: Headers
  json: () => Promise<unknown>
}

export const createJsonRequest = (
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown
): MockApiRequest => ({
  method,
  nextUrl: new URL(url),
  headers: new Headers(body ? { 'Content-Type': 'application/json' } : undefined),
  json: async () => body,
})
