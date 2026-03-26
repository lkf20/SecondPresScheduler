type PdfPageLike = {
  setContent: (html: string, options?: Record<string, unknown>) => Promise<unknown>
  setDefaultNavigationTimeout?: (timeout: number) => void
  setDefaultTimeout?: (timeout: number) => void
}

const isTimeoutError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return /Timed out after waiting/i.test(message) || /Navigation timeout/i.test(message)
}

export const configurePdfPageTimeouts = (page: PdfPageLike) => {
  if (typeof page.setDefaultNavigationTimeout === 'function') {
    page.setDefaultNavigationTimeout(0)
  }
  if (typeof page.setDefaultTimeout === 'function') {
    page.setDefaultTimeout(0)
  }
}

export const setPdfContentWithFallback = async (page: PdfPageLike, html: string) => {
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 })
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch (fallbackError) {
      if (!isTimeoutError(fallbackError)) throw fallbackError
      await page.setContent(html, { timeout: 0 })
    }
  }
}
