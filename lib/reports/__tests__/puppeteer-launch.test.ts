/** @jest-environment node */

const existsSyncMock = jest.fn()
const launchMock = jest.fn()
const homedirMock = jest.fn()
const chromiumExecutablePathMock = jest.fn()

jest.mock('node:fs', () => ({
  __esModule: true,
  default: {
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
  },
}))

jest.mock('node:os', () => ({
  __esModule: true,
  default: {
    homedir: () => homedirMock(),
  },
}))

jest.mock('@sparticuz/chromium', () => ({
  __esModule: true,
  default: {
    args: ['--foo'],
    headless: 'shell',
    executablePath: (...args: unknown[]) => chromiumExecutablePathMock(...args),
  },
}))

jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: {
    launch: (...args: unknown[]) => launchMock(...args),
  },
}))

describe('puppeteer launch helpers', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    homedirMock.mockReturnValue('/home/test')
    chromiumExecutablePathMock.mockResolvedValue('/mock/chromium')
    existsSyncMock.mockImplementation((candidate: string) => candidate === '/mock/chromium')
    delete process.env.PUPPETEER_EXECUTABLE_PATH
  })

  it('prefers PUPPETEER_EXECUTABLE_PATH when present', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chrome'
    existsSyncMock.mockImplementation((candidate: string) => candidate === '/custom/chrome')
    const { resolvePuppeteerExecutablePath } = await import('@/lib/reports/puppeteer-launch')

    await expect(resolvePuppeteerExecutablePath()).resolves.toBe('/custom/chrome')
  })

  it('falls back to @sparticuz/chromium executable path', async () => {
    const { resolvePuppeteerExecutablePath } = await import('@/lib/reports/puppeteer-launch')

    await expect(resolvePuppeteerExecutablePath()).resolves.toBe('/mock/chromium')
  })

  it('launchPdfBrowser passes executablePath and chromium launch options', async () => {
    launchMock.mockResolvedValue({ ok: true })
    const { launchPdfBrowser } = await import('@/lib/reports/puppeteer-launch')

    await launchPdfBrowser()

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: '/mock/chromium',
        args: expect.arrayContaining(['--foo', '--no-sandbox', '--disable-setuid-sandbox']),
        headless: 'shell',
      })
    )
  })

  it('throws when no executable path can be resolved', async () => {
    chromiumExecutablePathMock.mockResolvedValue(null)
    existsSyncMock.mockReturnValue(false)
    const { launchPdfBrowser } = await import('@/lib/reports/puppeteer-launch')

    await expect(launchPdfBrowser()).rejects.toThrow(
      'Unable to resolve Chromium executable path for PDF generation.'
    )
  })
})
