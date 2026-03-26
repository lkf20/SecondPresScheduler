/** @jest-environment node */

const existsSyncMock = jest.fn()
const mkdtempSyncMock = jest.fn()
const launchMock = jest.fn()
const homedirMock = jest.fn()
const tmpdirMock = jest.fn()
const chromiumExecutablePathMock = jest.fn()

jest.mock('node:fs', () => ({
  __esModule: true,
  default: {
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    mkdtempSync: (...args: unknown[]) => mkdtempSyncMock(...args),
  },
}))

jest.mock('node:os', () => ({
  __esModule: true,
  default: {
    homedir: () => homedirMock(),
    tmpdir: () => tmpdirMock(),
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
    tmpdirMock.mockReturnValue('/tmp')
    mkdtempSyncMock.mockReturnValue('/tmp/pdf-chrome-profile-abc')
    chromiumExecutablePathMock.mockResolvedValue('/mock/chromium')
    existsSyncMock.mockImplementation((candidate: string) => candidate === '/mock/chromium')
    delete process.env.PUPPETEER_EXECUTABLE_PATH
    delete process.env.VERCEL
    delete process.env.AWS_EXECUTION_ENV
    delete process.env.LAMBDA_TASK_ROOT
    delete process.env.PDF_DEBUG
  })

  it('prefers PUPPETEER_EXECUTABLE_PATH when present', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chrome'
    existsSyncMock.mockImplementation((candidate: string) => candidate === '/custom/chrome')
    const { resolvePuppeteerExecutablePath } = await import('@/lib/reports/puppeteer-launch')

    await expect(resolvePuppeteerExecutablePath()).resolves.toBe('/custom/chrome')
  })

  it('falls back to @sparticuz/chromium executable path on serverless runtime', async () => {
    process.env.VERCEL = '1'
    const { resolvePuppeteerExecutablePath } = await import('@/lib/reports/puppeteer-launch')

    await expect(resolvePuppeteerExecutablePath()).resolves.toBe('/mock/chromium')
  })

  it('returns undefined on local runtime when env executable is missing', async () => {
    const { resolvePuppeteerExecutablePath } = await import('@/lib/reports/puppeteer-launch')

    await expect(resolvePuppeteerExecutablePath()).resolves.toBeUndefined()
  })

  it('launchPdfBrowser uses shell headless + serverless args on Vercel', async () => {
    process.env.VERCEL = '1'
    launchMock.mockResolvedValue({ ok: true })
    const { launchPdfBrowser } = await import('@/lib/reports/puppeteer-launch')

    await launchPdfBrowser()

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: '/mock/chromium',
        args: expect.arrayContaining(['--foo', '--no-sandbox', '--disable-setuid-sandbox']),
        headless: 'shell',
        timeout: 120000,
        protocolTimeout: 120000,
      })
    )
  })

  it('launchPdfBrowser uses local args for regular Chrome binaries', async () => {
    launchMock.mockResolvedValue({ ok: true })
    process.env.PUPPETEER_EXECUTABLE_PATH =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    existsSyncMock.mockImplementation(
      (candidate: string) => candidate === process.env.PUPPETEER_EXECUTABLE_PATH
    )
    const { launchPdfBrowser } = await import('@/lib/reports/puppeteer-launch')

    await launchPdfBrowser()

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: expect.arrayContaining([
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
        ]),
        headless: true,
        timeout: 45000,
        protocolTimeout: 45000,
        pipe: false,
      })
    )
  })

  it('throws when no executable path can be resolved', async () => {
    existsSyncMock.mockReturnValue(false)
    const { launchPdfBrowser } = await import('@/lib/reports/puppeteer-launch')

    await expect(launchPdfBrowser()).rejects.toThrow(
      'Local Chrome path missing or invalid. Set PUPPETEER_EXECUTABLE_PATH to a valid Chrome executable.'
    )
  })

  it('retries local launch with fallback options', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    existsSyncMock.mockImplementation(
      (candidate: string) => candidate === process.env.PUPPETEER_EXECUTABLE_PATH
    )
    launchMock.mockRejectedValueOnce(new Error('first failed')).mockResolvedValueOnce({ ok: true })
    const { launchPdfBrowser } = await import('@/lib/reports/puppeteer-launch')

    await launchPdfBrowser()

    expect(launchMock).toHaveBeenCalledTimes(2)
  })

  it('returns combined failure details when all local attempts fail', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    existsSyncMock.mockImplementation(
      (candidate: string) => candidate === process.env.PUPPETEER_EXECUTABLE_PATH
    )
    launchMock.mockRejectedValue(new Error('failed to launch'))
    const { launchPdfBrowser } = await import('@/lib/reports/puppeteer-launch')

    await expect(launchPdfBrowser()).rejects.toThrow(
      /Failed to launch local Chrome for PDF generation/
    )
    expect(launchMock).toHaveBeenCalledTimes(3)
  })
})
