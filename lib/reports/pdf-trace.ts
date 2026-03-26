export type PdfTraceStep = {
  name: string
  ms: number
  ok: boolean
  error?: string
}

export const runPdfStep = async <T>(
  steps: PdfTraceStep[],
  name: string,
  fn: () => Promise<T>,
  timeoutMs = 120000
): Promise<T> => {
  const started = Date.now()
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
    steps.push({ name, ms: Date.now() - started, ok: true })
    return result
  } catch (error) {
    steps.push({
      name,
      ms: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
