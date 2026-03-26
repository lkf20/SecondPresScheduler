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
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`${name} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
      timeoutHandle.unref?.()
    })
    const result = await Promise.race([fn(), timeoutPromise])
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
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}
